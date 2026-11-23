import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const Input = z.object({ division: z.string(), invoiceId: z.string().uuid(), amount: z.number().finite().positive().max(100000000).optional() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "A valid invoice is required." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check invoice and installment amount." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["parent.read", "finance.manage"]);
  if (!result.ok) return result.response;
  const rate = await result.access.supabase.rpc("upwa_consume_rate_limit", { p_key: "bank-transfer-intent", p_limit: 10, p_window_seconds: 3600 });
  if (rate.error) return NextResponse.json({ error: "Payment rate controls are unavailable." }, { status: 503 });
  if (!rate.data) return NextResponse.json({ error: "Too many transfer instructions were requested. Try again later." }, { status: 429 });
  const { data, error } = await result.access.supabase.rpc("upwa_get_guardian_bank_instructions", {
    p_invoice_id: parsed.data.invoiceId,
    p_amount: parsed.data.amount ?? null,
  });
  if (error) return NextResponse.json({ error: "No approved U&C Microfinance Bank instructions or invoice balance are available." }, { status: 409 });
  return NextResponse.json({ instruction: Array.isArray(data) ? data[0] : data });
}
