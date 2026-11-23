import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const AttendanceInput = z.object({
  division: z.enum(["PRIMARY_EARLY_YEARS", "SECONDARY"]),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function GET(request: NextRequest) {
  const divisionCode = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(divisionCode, ["academics.read", "parent.read", "student.read"]);
  if (!result.ok) return result.response;

  let query = result.access.supabase
    .from("attendance_records")
    .select("id, student_id, attendance_date, status, notes, recorded_at")
    .order("attendance_date", { ascending: false })
    .limit(100);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load authorised attendance records." }, { status: 503 });
  return NextResponse.json({ records: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  }
  const parsed = AttendanceInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the attendance details and try again." }, { status: 400 });

  const result = await requirePortalAccess(parsed.data.division, ["academics.manage"]);
  if (!result.ok) return result.response;
  if (!result.access.divisionId) return NextResponse.json({ error: "Choose a specific school division." }, { status: 400 });

  const { data: currentPeriod, error: periodError } = await result.access.supabase
    .from("division_academic_calendars")
    .select("session_id")
    .eq("division_id", result.access.divisionId)
    .eq("is_current", true)
    .maybeSingle();
  if (periodError || !currentPeriod) {
    return NextResponse.json({ error: "No current session and term are configured for this division." }, { status: 409 });
  }

  const { data, error } = await result.access.supabase
    .from("attendance_records")
    .upsert(
      {
        student_id: parsed.data.studentId,
        class_id: parsed.data.classId,
        division_id: result.access.divisionId,
        session_id: currentPeriod.session_id,
        attendance_date: parsed.data.attendanceDate,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        recorded_by: result.access.user.id,
      },
      { onConflict: "student_id,session_id,attendance_date", ignoreDuplicates: false }
    )
    .select("id, student_id, attendance_date, status, recorded_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "Attendance already exists for this pupil and date." : "Attendance could not be saved. Confirm the class assignment and try again." },
      { status: error.code === "42501" ? 403 : 400 }
    );
  }
  return NextResponse.json({ record: data }, { status: 201 });
}
