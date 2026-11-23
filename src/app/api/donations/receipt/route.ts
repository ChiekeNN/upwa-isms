import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
export async function GET(request:NextRequest){
  const token=request.nextUrl.searchParams.get("token")||"";
  if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))return NextResponse.json({error:"Receipt is not ready or the link is invalid."},{status:404});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!isSupabaseConfigured()||!url||!key)return NextResponse.json({error:"Receipt service unavailable."},{status:503});
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const digest=createHash("sha256").update(token).digest("hex");
  const {data,error}=await admin.rpc("upwa_get_donation_receipt",{p_token_hash:digest});
  if(error||!data)return NextResponse.json({error:"Payment has not yet been verified, or this private receipt link is invalid."},{status:404});
  return NextResponse.json({receipt:data});
}
