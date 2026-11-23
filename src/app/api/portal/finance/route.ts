import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "";
  const from = request.nextUrl.searchParams.get("from") || null;
  const to = request.nextUrl.searchParams.get("to") || null;
  const accessResult = await requirePortalAccess(division, ["finance.read", "finance.manage"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  let scheduleQuery = access.supabase.from("fee_schedules").select("id,division_id,class_id,session_id,term_id,student_category,fee_code,description,amount,due_on,is_active").eq("is_active", true).order("fee_code").limit(300);
  let invoiceQuery = access.supabase.from("invoices").select("id,invoice_number,student_id,division_id,session_id,term_id,total_amount,amount_paid,status,due_date,student_category,created_at").order("created_at", { ascending: false }).limit(100);
  let expenseQuery = access.supabase.from("finance_expenses").select("id,category,payee,description,amount,expense_date,status,requestor_id,created_at,division_id").order("created_at", { ascending: false }).limit(100);
  let classQuery = access.supabase.from("classes").select("id,name,division_id,sort_order").order("sort_order");
  let studentQuery = access.supabase.from("students").select("id,admission_number,first_name,last_name,current_class_id,student_category,current_division_id").eq("status", "ACTIVE").order("last_name").limit(1000);
  if (access.divisionId) { scheduleQuery=scheduleQuery.eq("division_id",access.divisionId); invoiceQuery=invoiceQuery.eq("division_id",access.divisionId); expenseQuery=expenseQuery.eq("division_id",access.divisionId); classQuery=classQuery.eq("division_id",access.divisionId); studentQuery=studentQuery.eq("current_division_id",access.divisionId); }
  const [summary, schedules, invoices, expenses, classes, sessions, terms, students] = await Promise.all([
    access.supabase.rpc("upwa_finance_summary", { p_division_id: access.divisionId, p_from: from, p_to: to }),
    scheduleQuery, invoiceQuery, expenseQuery, classQuery,
    access.supabase.from("sessions").select("id,name,is_current,starts_on").order("starts_on",{ascending:false}),
    access.supabase.from("terms").select("id,name,session_id,is_current").order("name"), studentQuery,
  ]);
  if (summary.error || schedules.error || invoices.error || expenses.error || classes.error || sessions.error || terms.error || students.error) return NextResponse.json({ error: "Could not load the division finance workspace." }, { status: 503 });
  return NextResponse.json({ summary: summary.data ?? {}, schedules: schedules.data ?? [], invoices: invoices.data ?? [], expenses: expenses.data ?? [], filters: { classes: classes.data ?? [], sessions: sessions.data ?? [], terms: terms.data ?? [], students: students.data ?? [] } });
}

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_FEE"), division: z.string(), classId: z.string().uuid().nullable(), sessionId: z.string().uuid(), termId: z.string().uuid(), studentCategory: z.enum(["ANY","DAY","BOARDING"]), code: z.string().trim().min(2).max(40), description: z.string().trim().min(2).max(160), amount: z.number().finite().min(0).max(100000000), dueOn: z.string().date().nullable().optional() }),
  z.object({ action: z.literal("GENERATE_INVOICE"), division: z.string(), studentId: z.string().uuid(), sessionId: z.string().uuid(), termId: z.string().uuid(), dueOn: z.string().date().nullable().optional() }),
  z.object({ action: z.literal("SUBMIT_EXPENSE"), division: z.string(), category: z.enum(["PAYROLL","DIESEL","UTILITIES","TEACHING_MATERIALS","STATIONERY","MAINTENANCE","REPAIRS","REMITTANCES","OTHER"]), payee: z.string().trim().min(2).max(160), description: z.string().trim().min(5).max(1000), amount: z.number().finite().positive().max(100000000), expenseDate: z.string().date(), documentPath: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("EXPENSE_DECISION"), division: z.string(), expenseId: z.string().uuid(), decision: z.enum(["APPROVE","REJECT","MARK_PAID"]), note: z.string().trim().max(500).optional() }),
]);

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "A valid finance operation is required." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the finance fields and try again." }, { status: 400 });
  const input = parsed.data;
  const needed = input.action === "EXPENSE_DECISION" ? ["finance.expense_approve"] : ["finance.manage"];
  const accessResult = await requirePortalAccess(input.division, needed);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  if (input.action === "SET_FEE") {
    const { data, error } = await access.supabase.from("fee_schedules").upsert({ division_id: access.divisionId, class_id: input.classId, session_id: input.sessionId, term_id: input.termId, student_category: input.studentCategory, fee_code: input.code, description: input.description, amount: input.amount, due_on: input.dueOn ?? null, created_by: access.user.id }, { onConflict: "division_id,class_id,session_id,term_id,student_category,fee_code" }).select("id").single();
    if (error) return NextResponse.json({ error: "Fee schedule could not be saved." }, { status: 409 });
    return NextResponse.json({ id: data.id });
  }
  if (input.action === "GENERATE_INVOICE") {
    const { data, error } = await access.supabase.rpc("upwa_generate_student_invoice", { p_student_id: input.studentId, p_session_id: input.sessionId, p_term_id: input.termId, p_due_date: input.dueOn ?? null });
    if (error) return NextResponse.json({ error: error.message.includes("already exists") ? error.message : "Invoice could not be generated from the configured fee schedule." }, { status: 409 });
    return NextResponse.json({ invoiceId: data });
  }
  if (input.action === "SUBMIT_EXPENSE") {
    const { data, error } = await access.supabase.from("finance_expenses").insert({ division_id: access.divisionId, category: input.category, payee: input.payee, description: input.description, amount: input.amount, expense_date: input.expenseDate, document_path: input.documentPath ?? null, requestor_id: access.user.id, status: "SUBMITTED" }).select("id").single();
    if (error) return NextResponse.json({ error: "Expense request could not be submitted." }, { status: 403 });
    return NextResponse.json({ expenseId: data.id }, { status: 201 });
  }
  const { data, error } = await access.supabase.rpc("upwa_approve_expense", { p_expense_id: input.expenseId, p_decision: input.decision, p_note: input.note ?? null });
  if (error) return NextResponse.json({ error: "The expense workflow could not advance; approvers cannot approve their own requests." }, { status: 409 });
  return NextResponse.json({ status: data });
}
