import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const date = request.nextUrl.searchParams.get("date");
  const studentId = request.nextUrl.searchParams.get("studentId");
  const result = await requirePortalAccess(division, ["care.manage", "parent.read"]);
  if (!result.ok) return result.response;
  let query = result.access.supabase.from("daily_care_logs").select("id,student_id,division_id,class_id,log_date,care_type,summary,details,guardian_visible,created_by,created_at").order("created_at", { ascending: false }).limit(100);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  if (date) query = query.eq("log_date", date);
  if (studentId) query = query.eq("student_id", studentId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Authorised daily-care records could not be loaded." }, { status: 503 });
  return NextResponse.json({ entries: data ?? [] });
}
const Input = z.object({ division: z.string(), studentId: z.string().uuid(), date: z.string().date(), type: z.enum(["ARRIVAL", "DEPARTURE", "MEAL", "NAP", "HYGIENE", "NOTE", "HEALTH_OBSERVATION"]), summary: z.string().trim().min(1).max(2000), details: z.record(z.string(), z.unknown()).default({}), guardianVisible: z.boolean().default(false), restrictedNote: z.string().trim().max(2000).optional() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid daily-care record." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the care event fields." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["care.manage"]);
  if (!result.ok) return result.response;
  const { data, error } = await result.access.supabase.rpc("upwa_record_care_event", {
    p_student_id: parsed.data.studentId, p_care_type: parsed.data.type, p_log_date: parsed.data.date,
    p_summary: parsed.data.summary, p_details: parsed.data.details, p_guardian_visible: parsed.data.guardianVisible,
    p_restricted_note: parsed.data.restrictedNote ?? null,
  });
  if (error) return NextResponse.json({ error: "Only assigned Primary / Early Years caregivers may record care. Health details remain restricted." }, { status: 403 });
  return NextResponse.json({ id: data }, { status: 201 });
}
