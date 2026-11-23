import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const divisionCode = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(divisionCode, [
    "academics.read",
    "registry.manage",
    "admissions.manage",
    "parent.read",
    "student.read",
  ]);
  if (!result.ok) return result.response;

  let query = result.access.supabase
    .from("students")
    .select("id, admission_number, first_name, middle_name, last_name, current_division_id, current_class_id, status, created_at")
    .order("last_name", { ascending: true })
    .limit(100);
  if (result.access.divisionId) query = query.eq("current_division_id", result.access.divisionId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load authorised student records." }, { status: 503 });
  return NextResponse.json({ students: data ?? [] });
}

const StudentInput = z.object({
  division: z.enum(["PRIMARY_EARLY_YEARS", "SECONDARY"]),
  admissionNumber: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9/-]+$/),
  classId: z.string().uuid().nullable().optional(),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]).nullable().optional(),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "A valid student record is required." }, { status: 400 });
  }
  const parsed = StudentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the student details and try again." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["registry.manage"]);
  if (!result.ok) return result.response;
  if (!result.access.divisionId) return NextResponse.json({ error: "Select a school division." }, { status: 400 });

  const { data, error } = await result.access.supabase.rpc("upwa_register_student", {
    p_division_id: result.access.divisionId,
    p_class_id: parsed.data.classId ?? null,
    p_admission_number: parsed.data.admissionNumber,
    p_first_name: parsed.data.firstName,
    p_middle_name: parsed.data.middleName || null,
    p_last_name: parsed.data.lastName,
    p_date_of_birth: parsed.data.dateOfBirth ?? null,
    p_gender: parsed.data.gender ?? null,
  });
  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "That admission number is already in use; no existing record was changed." : "The student could not be registered. Confirm the current academic session and class placement." }, { status: duplicate ? 409 : 400 });
  }
  return NextResponse.json({ studentId: data }, { status: 201 });
}
