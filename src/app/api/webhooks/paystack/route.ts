import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const secret = process.env.PAYSTACK_SECRET_KEY || "";
  if (!secret) return NextResponse.json({ error: "Paystack verification is not configured." }, { status: 503 });
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const supplied = /^[a-f0-9]{128}$/i.test(signature) ? Buffer.from(signature, "hex") : Buffer.alloc(0);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid webhook event." }, { status: 400 }); }
  if (event?.event !== "charge.success") return NextResponse.json({ received: true, processed: false });
  const reference = String(event?.data?.reference ?? "");
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(reference)) return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400 });
  const verification = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { authorization: `Bearer ${secret}`, accept: "application/json" }, cache: "no-store" });
  if (!verification.ok) return NextResponse.json({ error: "Could not verify the transaction with Paystack." }, { status: 503 });
  const verified = await verification.json();
  const tx = verified?.data;
  if (!verified?.status || tx?.status !== "success" || tx?.reference !== reference || !Number.isFinite(Number(tx?.amount)) || !Number.isFinite(Number(tx?.amount) / 100)) {
    return NextResponse.json({ error: "Paystack did not confirm this transaction." }, { status: 409 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !url || !serviceKey) return NextResponse.json({ error: "Payment ledger is not configured." }, { status: 503 });
  const supabase = createSupabaseClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const eventReference = String(event?.data?.id ?? event?.id ?? reference);
  const { error } = await supabase.rpc("upwa_record_paystack_verification", {
    p_reference: reference,
    p_event_reference: eventReference,
    p_verified_amount: Number(tx.amount) / 100,
    p_currency: String(tx.currency ?? "").toUpperCase(),
    p_provider_status: String(tx.status ?? ""),
  });
  if (error) return NextResponse.json({ error: "Verified payment could not be recorded. Contact finance support before retrying." }, { status: 409 });
  return NextResponse.json({ received: true, processed: true });
}
