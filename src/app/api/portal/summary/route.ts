import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const DATA_PERMISSIONS = [
  "executive.read",
  "academics.read",
  "finance.read",
  "admissions.manage",
  "parent.read",
  "student.read",
  "care.manage",
  "pickup.manage",
];

export async function GET(request: NextRequest) {
  const divisionCode = request.nextUrl.searchParams.get("division") || "ALL";
  const accessResult = await requirePortalAccess(divisionCode, DATA_PERMISSIONS);
  if (!accessResult.ok) return accessResult.response;

  const { access } = accessResult;
  const studentQuery = access.supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");
  if (access.divisionId) studentQuery.eq("current_division_id", access.divisionId);
  const studentsResult = await studentQuery;
  if (studentsResult.error) {
    return NextResponse.json({ error: "Could not load enrolment summary." }, { status: 503 });
  }

  let attendance: { present: number; absent: number; late: number; excused: number } | null = null;
  if (access.permissions.includes("academics.read") || access.permissions.includes("parent.read") || access.permissions.includes("student.read")) {
    let attendanceQuery = access.supabase
      .from("attendance_records")
      .select("status")
      .eq("attendance_date", new Date().toISOString().slice(0, 10));
    if (access.divisionId) attendanceQuery = attendanceQuery.eq("division_id", access.divisionId);
    const { data, error } = await attendanceQuery;
    if (!error) {
      attendance = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const record of data ?? []) {
        if (record.status === "PRESENT") attendance.present += 1;
        if (record.status === "ABSENT") attendance.absent += 1;
        if (record.status === "LATE") attendance.late += 1;
        if (record.status === "EXCUSED") attendance.excused += 1;
      }
    }
  }

  let finance: { billed: number; collected: number; outstanding: number } | null = null;
  if (access.permissions.includes("finance.read")) {
    let invoiceQuery = access.supabase.from("invoices").select("total_amount, amount_paid");
    if (access.divisionId) invoiceQuery = invoiceQuery.eq("division_id", access.divisionId);
    const { data, error } = await invoiceQuery.limit(5000);
    if (error) {
      return NextResponse.json({ error: "Could not load authorised finance totals." }, { status: 503 });
    }
    finance = (data ?? []).reduce(
      (totals, invoice) => {
        totals.billed += Number(invoice.total_amount || 0);
        totals.collected += Number(invoice.amount_paid || 0);
        return totals;
      },
      { billed: 0, collected: 0, outstanding: 0 }
    );
    finance.outstanding = Math.max(0, finance.billed - finance.collected);
  }

  let admissions: { submitted: number; underReview: number; offered: number } | null = null;
  if (access.permissions.includes("admissions.manage")) {
    let applicationQuery = access.supabase.from("admission_applications").select("status");
    if (access.divisionId) applicationQuery = applicationQuery.eq("division_id", access.divisionId);
    const { data, error } = await applicationQuery.limit(5000);
    if (error) {
      return NextResponse.json({ error: "Could not load admissions summary." }, { status: 503 });
    }
    admissions = { submitted: 0, underReview: 0, offered: 0 };
    for (const application of data ?? []) {
      if (application.status === "SUBMITTED") admissions.submitted += 1;
      if (["UNDER_REVIEW", "EXAM_SCHEDULED"].includes(application.status)) admissions.underReview += 1;
      if (["OFFERED", "WAITLISTED", "ACCEPTED"].includes(application.status)) admissions.offered += 1;
    }
  }

  return NextResponse.json({
    division: access.divisionCode,
    generatedAt: new Date().toISOString(),
    enrolment: { activeStudents: studentsResult.count ?? 0 },
    attendance,
    finance,
    admissions,
    roles: access.roles.map(({ code, label }) => ({ code, label })),
  });
}
