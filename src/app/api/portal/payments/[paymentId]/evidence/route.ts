import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const ALLOWED = new Map([["application/pdf", "pdf"], ["image/jpeg", "jpg"], ["image/png", "png"]]);
export async function POST(request: NextRequest, context: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await context.params;
  const division = request.nextUrl.searchParams.get("division") || "";
  const result = await requirePortalAccess(division, ["parent.read", "finance.manage"]);
  if (!result.ok) return result.response;
  const rate = await result.access.supabase.rpc("upwa_consume_rate_limit", { p_key: "bank-transfer-evidence", p_limit: 8, p_window_seconds: 3600 });
  if (rate.error) return NextResponse.json({ error: "Upload rate controls are unavailable." }, { status: 503 });
  if (!rate.data) return NextResponse.json({ error: "Evidence upload limit reached. Try again later." }, { status: 429 });
  const { data: payment, error: paymentError } = await result.access.supabase.from("payment_transactions")
    .select("id,student_id,division_id,provider,status").eq("id", paymentId).maybeSingle();
  if (paymentError || !payment || payment.provider !== "BANK_TRANSFER" || !["PENDING", "EVIDENCE_SUBMITTED"].includes(payment.status)) {
    return NextResponse.json({ error: "This transfer is unavailable for evidence submission." }, { status: 404 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("evidence");
  if (!(file instanceof File)) return NextResponse.json({ error: "Select a bank receipt or transfer confirmation." }, { status: 400 });
  const ext = ALLOWED.get(file.type);
  if (!ext || file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Evidence must be a PDF, JPEG or PNG up to 5 MB." }, { status: 400 });
  const path = `${payment.id}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await result.access.supabase.storage.from("upwa-payment-evidence").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Private evidence upload failed. Please retry or contact finance." }, { status: 503 });
  const { error } = await result.access.supabase.from("payment_evidence").insert({ payment_id: payment.id, storage_path: path, mime_type: file.type, submitted_by: result.access.user.id });
  if (error) {
    await result.access.supabase.storage.from("upwa-payment-evidence").remove([path]);
    return NextResponse.json({ error: "Evidence could not be linked to the transfer." }, { status: 403 });
  }
  return NextResponse.json({ uploaded: true }, { status: 201 });
}
