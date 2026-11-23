import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";
const esc = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const currency = (value: unknown) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || bearer.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(bearer));
}
function period(frequency: string, now = new Date()) {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let from = new Date(to);
  let key: string;
  if (frequency === "DAILY") key = `D-${to.toISOString().slice(0, 10)}`;
  else if (frequency === "MONTHLY") {
    from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    key = `M-${from.toISOString().slice(0, 7)}`;
  } else {
    const day = to.getUTCDay() || 7;
    from = new Date(to); from.setUTCDate(to.getUTCDate() - day + 1);
    key = `W-${from.toISOString().slice(0, 10)}`;
  }
  return { key, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Scheduled job authentication required." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.BRIEF_FROM_EMAIL;
  if (!isSupabaseConfigured() || !url || !serviceKey || !resendKey || !fromEmail) return NextResponse.json({ error: "Brief delivery is not configured." }, { status: 503 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const now = new Date().toISOString();
  const [schedules, retries] = await Promise.all([
    admin.from("executive_brief_schedules").select("id,owner_id,recipient_user_id,division_id,frequency,next_run_at").eq("is_active", true).lte("next_run_at", now).limit(100),
    admin.from("executive_brief_runs").select("id,schedule_id,period_key").eq("status", "FAILED").lt("attempt_count", 4).lte("next_attempt_at", now).limit(100),
  ]);
  if (schedules.error || retries.error) return NextResponse.json({ error: "Could not load scheduled report jobs." }, { status: 503 });
  const byId = new Map((schedules.data ?? []).map((row) => [row.id, row]));
  const retryKeys = new Map((retries.data ?? []).map((row) => [row.schedule_id, row.period_key]));
  for (const scheduleId of retryKeys.keys()) if (!byId.has(scheduleId)) {
    const { data } = await admin.from("executive_brief_schedules").select("id,owner_id,recipient_user_id,division_id,frequency,next_run_at").eq("id", scheduleId).eq("is_active", true).maybeSingle();
    if (data) byId.set(scheduleId, data);
  }
  let sent = 0; let failed = 0; let skipped = 0;
  for (const schedule of byId.values()) {
    const dateRange = period(schedule.frequency);
    const periodKey = retryKeys.get(schedule.id) ?? dateRange.key;
    const recipient = await admin.auth.admin.getUserById(schedule.recipient_user_id);
    const email = recipient.data.user?.email;
    if (recipient.error || !email || !recipient.data.user?.email_confirmed_at) {
      await admin.from("executive_brief_schedules").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", schedule.id);
      failed++; continue;
    }
    const { data: report, error: reportError } = await admin.rpc("upwa_morning_brief", { p_division_id: schedule.division_id, p_from: dateRange.from, p_to: dateRange.to });
    if (reportError || !report) { failed++; continue; }
    const { data: runId, error: claimError } = await admin.rpc("upwa_claim_brief_run", { p_schedule_id: schedule.id, p_period_key: periodKey, p_report: report });
    if (claimError || !runId) { skipped++; continue; }
    const totals = [
      ["Received", currency(report.received)], ["Expenses approved", currency(report.expensesApproved)],
      ["Expenses paid", currency(report.expensesPaid)], ["Current arrears", currency(report.arrears)],
    ];
    const divisions = (report.feeCollectionByDivision ?? []).map((row: { division: string; received: number }) => `<li>${esc(row.division)}: <strong>${esc(currency(row.received))}</strong></li>`).join("");
    const flags = (report.operationalFlags ?? []).map((flag: string) => `<li>${esc(flag)}</li>`).join("");
    const html = `<main style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172554"><p style="text-transform:uppercase;color:#1d4ed8">UPWA International Schools · Executive digest</p><h1>President’s Morning Brief</h1><p>Period ${esc(dateRange.from)} to ${esc(dateRange.to)} · ${esc(schedule.frequency.toLowerCase())} schedule</p><ul>${totals.map(([label, value]) => `<li>${label}: <strong>${esc(value)}</strong></li>`).join("")}</ul><h2>Fee collection by division</h2><ul>${divisions || "<li>No verified receipts in this period.</li>"}</ul><h2>Attendance</h2><p>Rate: ${report.attendance?.rate == null ? "No data" : `${esc(report.attendance.rate)}%`}</p><h2>Admissions and approvals</h2><p>${esc(report.admissions?.received ?? 0)} applications received; ${esc(report.admissions?.pending ?? 0)} pending. Pending approvals: ${esc(report.pendingExecutiveApprovals?.resultBatches ?? 0)} results, ${esc(report.pendingExecutiveApprovals?.expenses ?? 0)} expenses, ${esc(report.pendingExecutiveApprovals?.feeAdjustments ?? 0)} fee adjustments.</p><h2>Operational flags</h2><ul>${flags || "<li>No current operational flags.</li>"}</ul><p style="font-size:12px;color:#64748b">Management information, not audited accounts. Sign in to the authorised UPWA portal for further detail.</p></main>`;
    const delivery = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json", "Idempotency-Key": createHash("sha256").update(String(runId)).digest("hex") },
      body: JSON.stringify({ from: fromEmail, to: [email], subject: "UPWA · President’s Morning Brief", html }), cache: "no-store",
    });
    const result = await delivery.json().catch(() => null);
    if (delivery.ok && result?.id) {
      await admin.rpc("upwa_finish_brief_run", { p_run_id: runId, p_success: true, p_error: null }); sent++;
    } else {
      const detail = `Resend ${delivery.status}: ${JSON.stringify(result).slice(0, 700)}`;
      await admin.rpc("upwa_finish_brief_run", { p_run_id: runId, p_success: false, p_error: detail }); failed++;
    }
  }
  return NextResponse.json({ processed: byId.size, sent, failed, skipped });
}

export const POST = GET;
