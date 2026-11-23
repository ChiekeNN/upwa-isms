import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const Input=z.object({campaignId:z.string().uuid(),amount:z.number().finite().min(100).max(100000000),name:z.string().trim().max(160).optional(),email:z.string().trim().email().max(254),publicConsent:z.boolean().default(false)});
export async function POST(request:NextRequest){
  const secret=process.env.CRON_SECRET||process.env.REPORT_SIGNING_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const paystack=process.env.PAYSTACK_SECRET_KEY;
  if(!isSupabaseConfigured()||!url||!serviceKey||!paystack||!secret)return NextResponse.json({error:"Verified donation processing is not configured."},{status:503});
  let raw:unknown;try{raw=await request.json();}catch{return NextResponse.json({error:"Invalid donation."},{status:400});}
  const parsed=Input.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"Check the campaign, amount and optional receipt email."},{status:400});
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const key=createHmac("sha256",secret).update(`donation:${ip}`).digest("hex");
  const {data:allowed,error:rateError}=await admin.rpc("upwa_consume_public_rate_limit",{p_key_hash:key,p_limit:5,p_window_seconds:3600});
  if(rateError)return NextResponse.json({error:"Donation rate controls are unavailable."},{status:503});
  if(!allowed)return NextResponse.json({error:"Donation attempt limit reached. Try again later."},{status:429});
  const reference=`UPWA-DON-${randomBytes(12).toString("hex").toUpperCase()}`;
  const receiptToken=randomBytes(32).toString("base64url");
  const tokenHash=createHash("sha256").update(receiptToken).digest("hex");
  const {error}=await admin.rpc("upwa_create_donation_intent",{p_campaign_id:parsed.data.campaignId,p_reference:reference,p_amount:parsed.data.amount,p_donor_name:parsed.data.name??null,p_donor_email:parsed.data.email??null,p_receipt_token_hash:tokenHash,p_public_consent:parsed.data.publicConsent});
  if(error)return NextResponse.json({error:"This donation campaign is not currently open."},{status:409});
  const response=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{authorization:`Bearer ${paystack}`,"content-type":"application/json",accept:"application/json"},body:JSON.stringify({email:parsed.data.email||"donor@upwa.invalid",amount:Math.round(parsed.data.amount*100),currency:"NGN",reference,callback_url:`${request.nextUrl.origin}/alumnae/receipt?token=${encodeURIComponent(receiptToken)}`,metadata:{donation:true,campaign_id:parsed.data.campaignId,donor_public_consent:parsed.data.publicConsent}}),cache:"no-store"});
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.status||!result?.data?.authorization_url)return NextResponse.json({error:"Paystack could not start this donation. No donation has been confirmed."},{status:502});
  return NextResponse.json({authorizationUrl:result.data.authorization_url,reference});
}
