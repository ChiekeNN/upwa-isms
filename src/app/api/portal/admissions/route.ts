import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const divisionCode = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(divisionCode, ["admissions.manage"]);
  if (!result.ok) return result.response;

  let query = result.access.supabase
    .from("admission_applications")
    .select("id, application_number, division_id, target_class_id, applicant_first_name, applicant_middle_name, applicant_last_name, date_of_birth, guardian_name, guardian_email, guardian_phone, status, exam_at, exam_venue, decision_note, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load authorised applications." }, { status: 503 });
  return NextResponse.json({ applications: data ?? [] });
}
