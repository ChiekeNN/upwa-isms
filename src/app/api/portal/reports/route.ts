import { NextRequest, NextResponse } from "next/server";
import { INSTITUTION_CONFIG } from "@/config/institution";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const accessMap: Record<string, string[]> = {
  enrolment: ["reports.read", "registry.manage", "academics.read"],
  admissions: ["reports.read", "admissions.manage"],
  attendance: ["reports.read", "academics.read"],
  staff: ["reports.read", "registry.manage"],
  results: ["reports.read", "academics.read", "results.read"],
  invoices: ["reports.read", "finance.read"],
  receipts: ["reports.read", "finance.read"],
  debtors: ["reports.read", "finance.read"],
  income: ["reports.read", "finance.read"],
  expenditure: ["reports.read", "finance.read"],
  activity: ["reports.read", "executive.read", "finance.read"],
};
const titles: Record<string, string> = { enrolment: "Enrolment", admissions: "Admissions", attendance: "Attendance", staff: "Staff", results: "Published academic results", invoices: "Invoices", receipts: "Payment receipts", debtors: "Debtor list", income: "Income", expenditure: "Expenditure", activity: "Executive activity" };
const csvCell = (value: unknown) => {
  let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const dateParam = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const report = params.get("report") ?? "";
  const division = params.get("division") || "ALL";
  const allowed = accessMap[report];
  if (!allowed) return NextResponse.json({ error: "Choose an approved report type." }, { status: 400 });
  const from = dateParam(params.get("from")); const to = dateParam(params.get("to"));
  if ((params.has("from") && !from) || (params.has("to") && !to) || (from && to && from > to)) return NextResponse.json({ error: "Date range is invalid." }, { status: 400 });
  const accessResult = await requirePortalAccess(division, allowed);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  const rate = await access.supabase.rpc("upwa_consume_rate_limit", { p_key: `export:${report}`, p_limit: 12, p_window_seconds: 3600 });
  if (rate.error) return NextResponse.json({ error: "Report rate control is unavailable." }, { status: 503 });
  if (rate.data !== true) return NextResponse.json({ error: "Export limit reached. Try again later." }, { status: 429 });
  const divisionFilter = (query: any, column = "division_id") => access.divisionId ? query.eq(column, access.divisionId) : query;
  let result: { data: any[] | null; error: any } = { data: [], error: null };
  if (report === "enrolment") {
    let q = access.supabase.from("students").select("admission_number,first_name,middle_name,last_name,status,student_category,current_division_id,current_class_id,created_at").order("last_name").limit(5000);
    q = divisionFilter(q, "current_division_id"); if (params.get("classId")) q = q.eq("current_class_id", params.get("classId")); if (params.get("category")) q = q.eq("student_category", params.get("category")); result = await q;
  } else if (report === "admissions") {
    let q = access.supabase.from("admission_applications").select("application_number,division_id,target_class_id,status,applicant_first_name,applicant_last_name,guardian_name,created_at,exam_at").order("created_at", { ascending: false }).limit(5000);
    q = divisionFilter(q); if (from) q=q.gte("created_at",`${from}T00:00:00Z`); if (to) q=q.lt("created_at",`${to}T23:59:59.999Z`); result=await q;
  } else if (report === "attendance") {
    let q = access.supabase.from("attendance_records").select("attendance_date,status,division_id,class_id,student_id,session_id").order("attendance_date",{ascending:false}).limit(5000);
    q=divisionFilter(q); if(from) q=q.gte("attendance_date",from); if(to) q=q.lte("attendance_date",to); if(params.get("sessionId"))q=q.eq("session_id",params.get("sessionId")); if(params.get("classId"))q=q.eq("class_id",params.get("classId")); result=await q;
  } else if (report === "staff") {
    let q=access.supabase.from("staff_profiles").select("staff_number,full_name,position_title,employment_status,subjects,division_id,started_on,ended_on").order("full_name").limit(3000); q=divisionFilter(q); result=await q;
  } else if (report === "results") {
    let q=access.supabase.from("assessment_scores").select("student_id,division_id,class_id,subject_id,component_id,session_id,term_id,numeric_score,developmental_level,score_state,published_at,subjects(name,code),assessment_components(label,maximum_score)").eq("status","PUBLISHED").order("published_at",{ascending:false}).limit(5000);
    q=divisionFilter(q); if(params.get("sessionId"))q=q.eq("session_id",params.get("sessionId")); if(params.get("termId"))q=q.eq("term_id",params.get("termId")); if(params.get("classId"))q=q.eq("class_id",params.get("classId")); result=await q;
  } else if (["invoices","debtors"].includes(report)) {
    let q=access.supabase.from("invoices").select("invoice_number,student_id,division_id,session_id,term_id,total_amount,amount_paid,status,due_date,student_category,created_at").order("created_at",{ascending:false}).limit(5000); q=divisionFilter(q);
    if(params.get("sessionId"))q=q.eq("session_id",params.get("sessionId")); if(params.get("termId"))q=q.eq("term_id",params.get("termId")); if(params.get("category"))q=q.eq("student_category",params.get("category")); if(from)q=q.gte("created_at",`${from}T00:00:00Z`); if(to)q=q.lt("created_at",`${to}T23:59:59.999Z`); result=await q;
    if(report==="debtors"&&result.data) result={...result,data:result.data.filter(row=>Number(row.total_amount)>Number(row.amount_paid)&&row.status!=="VOID")};
  } else if (report === "receipts") {
    let q=access.supabase.from("finance_receipts").select("receipt_number,payment_id,issued_at,document_hash").order("issued_at",{ascending:false}).limit(5000); if(from)q=q.gte("issued_at",`${from}T00:00:00Z`); if(to)q=q.lt("issued_at",`${to}T23:59:59.999Z`); result=await q;
  } else if (report === "income") {
    let q=access.supabase.from("ledger_entries").select("division_id,entry_type,category,amount,reference_code,posted_at").in("entry_type",["INCOME","REVERSAL"]).order("posted_at",{ascending:false}).limit(5000); q=divisionFilter(q); if(from)q=q.gte("posted_at",`${from}T00:00:00Z`); if(to)q=q.lt("posted_at",`${to}T23:59:59.999Z`); result=await q;
  } else if (report === "expenditure") {
    let q=access.supabase.from("finance_expenses").select("division_id,category,payee,description,amount,expense_date,status,payment_reference,approved_at,paid_at").order("expense_date",{ascending:false}).limit(5000); q=divisionFilter(q); if(from)q=q.gte("expense_date",from); if(to)q=q.lte("expense_date",to); result=await q;
  } else if (report === "activity") {
    const { data, error }=await access.supabase.rpc("upwa_executive_activity",{p_division_id:access.divisionId,p_limit:100}); result={data,error};
  }
  if(result.error) return NextResponse.json({error:"The requested report is not available within your database permissions."},{status:403});
  const rows=result.data??[];
  const generatedAt=new Date().toISOString();
  const header=[`Report: ${titles[report]}`,`School: ${INSTITUTION_CONFIG.institutionalWebsiteName}`,`Division: ${division}`,`Session: ${params.get("sessionId")??"All"}`,`Term: ${params.get("termId")??"All"}`,`Class: ${params.get("classId")??"All"}`,`Category: ${params.get("category")??"All"}`,`From: ${from??"—"}`,`To: ${to??"—"}`,`Generated: ${generatedAt}`,""];
  const columns=rows.length?Object.keys(rows[0]):[];
  const csv=[...header.map((v)=>csvCell(v)),columns.map(csvCell).join(","),...rows.map((row)=>columns.map((key)=>csvCell(row[key])).join(","))].join("\r\n");
  return new NextResponse(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="upwa-${report}-${generatedAt.slice(0,10)}.csv"`,"cache-control":"no-store"}});
}
