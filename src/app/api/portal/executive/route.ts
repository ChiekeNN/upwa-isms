import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

function monthKeys(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - index - 1), 1));
    return date.toISOString().slice(0, 7);
  });
}

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const accessResult = await requirePortalAccess(division, ["executive.read"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  const divisionId = division === "ALL" ? null : access.divisionId;
  const start = new Date(); start.setUTCMonth(start.getUTCMonth() - 5, 1);
  const from = start.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const [summary, divisions, activity, payments, expenses, attendance, invoices, publishedScores] = await Promise.all([
    access.supabase.rpc("upwa_finance_summary", { p_division_id: divisionId, p_from: from, p_to: to }),
    access.supabase.from("school_divisions").select("id,code,name").order("name"),
    access.supabase.rpc("upwa_executive_activity", { p_division_id: divisionId, p_limit: 40 }),
    access.supabase.from("payment_transactions").select("division_id,amount,verified_at").eq("status", "VERIFIED").gte("verified_at", from),
    access.supabase.from("finance_expenses").select("division_id,amount,expense_date").eq("status", "PAID").gte("expense_date", from),
    access.supabase.from("attendance_records").select("status,division_id").eq("attendance_date", to),
    access.supabase.from("invoices").select("division_id,total_amount,amount_paid"),
    access.supabase.from("assessment_scores").select("division_id,numeric_score,developmental_level").eq("status", "PUBLISHED").limit(10000),
  ]);
  if (summary.error || divisions.error || activity.error || payments.error || expenses.error || attendance.error || invoices.error || publishedScores.error) return NextResponse.json({ error: "Executive data is unavailable for this authorised account." }, { status: 503 });
  const inScope = (id: string) => !divisionId || id === divisionId;
  const keys = monthKeys(6);
  const trend = keys.map((month) => ({ month, collected: 0, expenses: 0 }));
  for (const payment of payments.data ?? []) {
    if (!inScope(payment.division_id)) continue;
    const month = String(payment.verified_at ?? "").slice(0, 7);
    const row = trend.find((item) => item.month === month); if (row) row.collected += Number(payment.amount || 0);
  }
  for (const expense of expenses.data ?? []) {
    if (!inScope(expense.division_id)) continue;
    const row = trend.find((item) => item.month === expense.expense_date.slice(0, 7)); if (row) row.expenses += Number(expense.amount || 0);
  }
  const attendanceCounts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const row of attendance.data ?? []) if (inScope(row.division_id)) {
    if (row.status === "PRESENT") attendanceCounts.present += 1;
    if (row.status === "ABSENT") attendanceCounts.absent += 1;
    if (row.status === "LATE") attendanceCounts.late += 1;
    if (row.status === "EXCUSED") attendanceCounts.excused += 1;
  }
  const invoiceRows = (invoices.data ?? []).filter((row) => inScope(row.division_id));
  const debtBuckets = { paid: 0, partial: 0, overdue: 0, unpaid: 0 };
  for (const row of invoiceRows) {
    const due = Math.max(0, Number(row.total_amount || 0) - Number(row.amount_paid || 0));
    if (due <= 0) debtBuckets.paid += 1;
    else if (Number(row.amount_paid || 0) > 0) debtBuckets.partial += 1;
    else debtBuckets.unpaid += 1;
  }
  const scoreRows = (publishedScores.data ?? []).filter((row) => inScope(row.division_id));
  const numericScores = scoreRows.map((row) => Number(row.numeric_score)).filter((n) => Number.isFinite(n));
  const monthly = trend.map((item) => ({ ...item, net: item.collected - item.expenses }));
  const summaryData = summary.data ?? {};
  const billed = Number(summaryData.billed ?? 0); const collected = Number(summaryData.collected ?? 0);
  const divisionComparison = await Promise.all((divisions.data ?? []).map(async (item) => {
    const { data, error } = await access.supabase.rpc("upwa_finance_summary", { p_division_id: item.id, p_from: from, p_to: to });
    return error || !data ? null : { id: item.id, name: item.name, billed: Number(data.billed ?? 0), collected: Number(data.collected ?? 0), expensesPaid: Number(data.expensesPaid ?? 0) };
  }));
  return NextResponse.json({
    division, generatedAt: new Date().toISOString(),
    summary: { ...summaryData, collectionPercent: billed > 0 ? Math.round(collected / billed * 10000) / 100 : 0, attendance: attendanceCounts, averagePublishedNumericScore: numericScores.length ? Math.round(numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length * 100) / 100 : null, publishedScoreCount: numericScores.length, debtors: debtBuckets },
    divisions: divisions.data ?? [], trend: monthly,
    divisionComparison: divisionComparison.filter(Boolean),
    activity: activity.data ?? [],
    caveats: ["Figures reflect recorded database entries for the selected period.", "Reconciled cash is shown only when an approved bank reconciliation exists.", "These management summaries are not audited financial statements."],
  });
}
