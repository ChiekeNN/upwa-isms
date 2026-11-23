import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const Input = z.object({ division: z.string(), invoiceId: z.string().uuid() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Choose a valid invoice." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid invoice." }, { status: 400 });
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const accessResult = await requirePortalAccess(parsed.data.division, ["parent.read", "finance.manage"]);
  if (!accessResult.ok) return accessResult.response;
  if (!secret || !accessResult.access.user.email) return NextResponse.json({ error: "Secure online payment is not configured for this account." }, { status: 503 });
  const reference = `UPWA-PAY-${randomBytes(12).toString("hex")}`;
  const { data, error } = await accessResult.access.supabase.rpc("upwa_create_payment_intent", { p_invoice_id: parsed.data.invoiceId, p_reference: reference });
  const payment = Array.isArray(data) ? data[0] : data;
  if (error || !payment) return NextResponse.json({ error: "Invoice is not available for this account or is already settled." }, { status: 409 });
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ email: accessResult.access.user.email, amount: Math.round(Number(payment.amount) * 100), currency: payment.currency, reference, callback_url: `${request.nextUrl.origin}/portal?payment=return` }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data?.authorization_url) return NextResponse.json({ error: "Paystack could not start this payment. No payment has been confirmed." }, { status: 502 });
  return NextResponse.json({ authorizationUrl: result.data.authorization_url, reference, amount: payment.amount });
}
