import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const Input = z.object({ division: z.string(), paymentId: z.string().uuid(), decision: z.enum(["VERIFY", "REJECT"]), note: z.string().trim().max(500).optional() });
export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "";
  const result = await requirePortalAccess(division, ["finance.manage"]);
  if (!result.ok) return result.response;
  let query = result.access.supabase.from("payment_transactions").select("id,external_reference,student_id,division_id,amount,status,created_at,metadata,created_by").eq("provider", "BANK_TRANSFER").in("status", ["PENDING", "EVIDENCE_SUBMITTED"]).order("created_at", { ascending: false }).limit(100);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data: payments, error } = await query;
  if (error) return NextResponse.json({ error: "Pending transfers could not be loaded." }, { status: 503 });
  const ids = (payments ?? []).map((payment) => payment.id);
  const evidence = ids.length ? await result.access.supabase.from("payment_evidence").select("id,payment_id,mime_type,created_at,submitted_by").in("payment_id", ids) : { data: [], error: null };
  if (evidence.error) return NextResponse.json({ error: "Transfer evidence could not be loaded." }, { status: 503 });
  return NextResponse.json({ payments: payments ?? [], evidence: evidence.data ?? [] });
}
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid review action." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the payment review fields." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["finance.manage"]);
  if (!result.ok) return result.response;
  const { data, error } = await result.access.supabase.rpc("upwa_review_manual_payment", {
    p_payment_id: parsed.data.paymentId,
    p_approve: parsed.data.decision === "VERIFY",
    p_note: parsed.data.note ?? null,
  });
  if (error) return NextResponse.json({ error: "Transfer review failed. Confirm the evidence and use an independent finance reviewer." }, { status: 409 });
  return NextResponse.json({ status: data });
}
