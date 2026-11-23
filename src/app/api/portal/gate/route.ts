import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "PRIMARY_EARLY_YEARS";
  const admissionNumber = request.nextUrl.searchParams.get("admissionNumber") || "";
  if (admissionNumber.length < 2 || admissionNumber.length > 50) return NextResponse.json({ error: "Enter the pupil’s admission number." }, { status: 400 });
  const result = await requirePortalAccess(division, ["pickup.manage"]);
  if (!result.ok) return result.response;
  const { data, error } = await result.access.supabase.rpc("upwa_gate_lookup", { p_admission_number: admissionNumber });
  if (error) return NextResponse.json({ error: "No authorised Primary / Early Years pupil was found." }, { status: 404 });
  const rows = await Promise.all((data ?? []).map(async (row: Record<string, any>) => {
    const { data: signed } = row.photo_storage_path ? await result.access.supabase.storage.from("upwa-pickup-photos").createSignedUrl(row.photo_storage_path, 90) : { data: null };
    return { ...row, photoUrl: signed?.signedUrl ?? null, photo_storage_path: undefined };
  }));
  const pupilRow=rows[0];
  return NextResponse.json({ pupil: pupilRow ? { id: pupilRow.student_id, admissionNumber: pupilRow.admission_number, name: pupilRow.student_name, className: pupilRow.class_name } : null, authorisations: rows.filter((row:Record<string,any>)=>row.authorisation_id) });
}
const Input = z.object({ division: z.string(), studentId: z.string().uuid(), authorisationId: z.string().uuid(), presentedName: z.string().trim().min(2).max(120), exceptionNote: z.string().trim().max(500).optional() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid release confirmation." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Pupil and person identity confirmation are required." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["pickup.manage"]);
  if (!result.ok) return result.response;
  const rate = await result.access.supabase.rpc("upwa_consume_rate_limit", { p_key: "gate-release", p_limit: 120, p_window_seconds: 60 });
  if (rate.error) return NextResponse.json({ error: "Gate release rate controls are unavailable." }, { status: 503 });
  if (!rate.data) return NextResponse.json({ error: "Gate action rate limit reached. Use the school escalation procedure." }, { status: 429 });
  const { data, error } = await result.access.supabase.rpc("upwa_gate_release", { p_student_id: parsed.data.studentId, p_authorisation_id: parsed.data.authorisationId, p_presented_name: parsed.data.presentedName, p_exception_note: parsed.data.exceptionNote ?? null });
  if (error) return NextResponse.json({ error: "The release could not be recorded. Keep the child with staff and contact the school administrator." }, { status: 409 });
  return NextResponse.json({ status: data, humanVerificationRequired: true });
}
