"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Crown,
  Cpu,
  FileDown,
  HeartHandshake,
  Inbox,
  Lock,
  Mail,
  School,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useDemo } from "../store";
import { Badge, Button, Card, CardHeader } from "../ui";
import { compactNaira, formatDate, formatLongDate, naira, termLabel, weekdayOf } from "../format";
import { computePresidentBrief, iso } from "../president-brief";
import { buildPresidentPdf } from "../president-pdf";

/**
 * The President's Office.
 *
 * Deliberately read-only: Dr. Chinwe Chike governs the school, she does not run
 * it. Everything here is assembled from the registers, the bursary ledger and
 * the office records, and expressed in plain language — what happened, what it
 * means, and what deserves her attention. The daily brief is prepared at the
 * close of work; the comprehensive report lands every Friday at 6:00 PM, and
 * both travel to her inbox as PDFs.
 */

const CATEGORY_COLOURS: Record<string, string> = {
  "Salaries & wages": "#0B2E46",
  "Feeding & kitchen": "#F39A1E",
  Utilities: "#0789B8",
  "Maintenance & facilities": "#7C3AED",
  "Learning materials": "#26894D",
  "ICT & platform": "#0EA5E9",
  "Transport & trips": "#DB2777",
  "Events & welfare": "#F59E0B",
  "Security & cleaning": "#64748B",
  "Medical & safety": "#DC2626",
};

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 12px 32px -12px rgba(11,46,70,0.25)",
} as const;

/* ------------------------------- animations ------------------------------ */

function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Kpi({
  label,
  value,
  render,
  note,
  icon: Icon,
  tone,
  delay = 0,
}: {
  label: string;
  value: number;
  render: (n: number) => string;
  note: string;
  icon: typeof Users;
  tone: "blue" | "green" | "orange" | "violet";
  delay?: number;
}) {
  const counted = useCountUp(value);
  const tones = {
    blue: "bg-upwa-blue-50 text-upwa-blue-800",
    green: "bg-upwa-green-50 text-upwa-green-800",
    orange: "bg-upwa-orange-50 text-upwa-orange-800",
    violet: "bg-violet-50 text-violet-800",
  } as const;
  return (
    <div
      className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel-lg"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-2 font-display text-[1.9rem] font-bold leading-none text-upwa-navy">{render(counted)}</p>
      <p className="mt-2.5 text-xs leading-5 text-slate-600">{note}</p>
    </div>
  );
}

function Meter({ value, tone, caption }: { value: number; tone: string; caption: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setWidth(Math.min(100, value)), 80);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-slate-700">{caption}</span>
        <span className="font-display text-sm font-bold text-upwa-navy">{Math.round(value)}%</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200/80">
        <div className={`h-full rounded-full ${tone} transition-all duration-1000 ease-out-expo`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/* ================================= workspace ============================== */

export function PresidentWorkspace() {
  const { data, notify } = useDemo();
  const [manualSends, setManualSends] = useState<{ kind: "daily" | "weekly"; at: Date; channel: "provider" | "local" }[]>([]);
  const [building, setBuilding] = useState<"" | "daily" | "weekly">("");

  const brief = useMemo(() => (data ? computePresidentBrief(data) : null), [data]);

  if (!data || !brief) {
    return <p className="py-10 text-center text-sm text-slate-500">Preparing the President's brief…</p>;
  }

  const { settings } = data;
  const hour = brief.now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const closeOfWork = hour >= 16;

  async function downloadPdf(kind: "daily" | "weekly") {
    if (!data) return;
    setBuilding(kind);
    try {
      const { filename, arrayBuffer } = await buildPresidentPdf(data, kind);
      const url = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      notify(kind === "daily" ? "Daily brief downloaded" : "Weekly report downloaded", "success", `PDF saved — a copy goes to ${settings.presidentEmail} on schedule.`);
    } catch (error) {
      notify("Could not build the PDF", "danger", String((error as Error).message));
    } finally {
      setBuilding("");
    }
  }

  /** Sends the brief as a real email through the school's mail provider (Resend). */
  async function emailNow(kind: "daily" | "weekly") {
    if (!data) return;
    setBuilding(kind);
    try {
      const { filename, subject, cover, arrayBuffer } = await buildPresidentPdf(data, kind);
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const response = await fetch("/api/president/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, filename, subject, cover, pdfBase64: btoa(binary) }),
      });
      const result = (await response.json().catch(() => ({}))) as { configured?: boolean; delivered?: boolean; to?: string[]; error?: string };
      if (response.ok && result.delivered) {
        setManualSends((current) => [...current, { kind, at: new Date(), channel: "provider" }]);
        notify("Delivered by email", "success", `${subject} → ${result.to?.join(", ") ?? settings.presidentEmail}, with the PDF attached.`);
      } else if (response.status === 503 || result.configured === false) {
        const url = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        setManualSends((current) => [...current, { kind, at: new Date(), channel: "local" }]);
        notify(
          "Mail provider not connected yet",
          "info",
          "The PDF was saved here instead. Set RESEND_API_KEY and PRESIDENT_FROM_EMAIL in the Vercel environment and this button emails it directly.",
        );
      } else {
        notify("Delivery failed", "danger", result.error ?? `The mail service answered ${response.status}.`);
      }
    } catch (error) {
      notify("Delivery failed", "danger", String((error as Error).message));
    } finally {
      setBuilding("");
    }
  }

  const topSpends = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount).slice(0, 7);
  const donut = brief.byCategory.slice(0, 5);
  const donutRest = brief.byCategory.slice(5).reduce((sum, item) => sum + item.value, 0);
  const donutData = donutRest > 0 ? [...donut, { name: "Everything else", value: donutRest }] : donut;

  return (
    <div className="space-y-5">
      {/* ------------------------------ header band ------------------------------ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-upwa-midnight via-upwa-navy to-upwa-blue-900 px-6 py-8 text-white shadow-panel-lg sm:px-9 sm:py-10">
        <div aria-hidden="true" className="pattern-grid pattern-fade pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[42px] border-upwa-orange-500/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full border-[36px] border-upwa-blue-400/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-upwa-orange-400">
              <Crown size={13} /> President&apos;s Office · read-only
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
              {greeting}, Dr. Chike
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {closeOfWork
                ? `Your close-of-work brief for ${weekdayOf(brief.today)}, ${formatLongDate(brief.today)} is ready — everything that happened in and around the school today, in plain words.`
                : `Here is the live position for ${weekdayOf(brief.today)}, ${formatLongDate(brief.today)}. The close-of-work brief is prepared automatically at 4:00 PM.`}
            </p>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Lock size={13} className="text-upwa-orange-400" />
              This office reads every record and changes none — registers, bursary and office updates are made by the school team.
            </p>
          </div>
          <dl className="grid w-full max-w-sm grid-cols-1 gap-2.5">
            {[
              { icon: Mail, label: "Daily brief PDF", value: `Every workday, 4:00 PM → ${settings.presidentEmail}` },
              { icon: FileDown, label: "Weekly comprehensive report", value: `Every Friday, 6:00 PM → ${settings.presidentEmail}` },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <item.icon size={16} className="mt-0.5 shrink-0 text-upwa-orange-400" />
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{item.label}</dt>
                  <dd className="mt-0.5 truncate text-xs font-semibold text-white">{item.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --------------------------------- KPIs --------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Pupils in school today"
          value={brief.present + brief.late}
          render={(n) => `${n} of ${brief.roll}`}
          note={`In plain words: about ${Math.round(brief.attendanceRate / 10)} in every 10 pupils were in class. Term average is ${brief.termAttendance}%.`}
          icon={Users}
          tone="blue"
        />
        <Kpi
          label="Money received today"
          value={brief.paidToday.reduce((sum, p) => sum + p.amount, 0)}
          render={naira}
          note={`${brief.paidToday.length} confirmed payment(s). A further ${naira(brief.pending.reduce((s, p) => s + p.amount, 0))} is waiting for the bursary to confirm.`}
          icon={TrendingUp}
          tone="green"
          delay={80}
        />
        <Kpi
          label="Money spent today"
          value={brief.spentToday.reduce((sum, e) => sum + e.amount, 0)}
          render={naira}
          note={brief.spentToday.some((e) => e.category === "Salaries & wages") ? "Payroll day — the largest single expense of the month, approved and paid." : `${brief.spentToday.length} payment(s) left the school account today.`}
          icon={TrendingDown}
          tone="orange"
          delay={160}
        />
        <Kpi
          label="Matters for your attention"
          value={brief.attention.length}
          render={(n) => String(n)}
          note={brief.attention[0].text}
          icon={AlertTriangle}
          tone="violet"
          delay={240}
        />
      </div>

      {/* ------------------------------- financials ------------------------------ */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Income against expense, week by week"
            subtitle={`Every week of ${settings.session} · ${termLabel(settings.currentTerm)}`}
            icon={<Wallet size={18} />}
            action={<Badge tone="green">{brief.collectionRate}% of billed fees in</Badge>}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={brief.weeklyChart} margin={{ top: 6, right: 6, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: "#64748b" }} axisLine={false} tickLine={false} angle={-32} textAnchor="end" height={52} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => compactNaira(value)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => naira(Number(value))} cursor={{ fill: "rgba(7,137,184,0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" name="Money in" fill="#26894D" radius={[5, 5, 0, 0]} maxBarSize={22} />
                <Bar dataKey="spend" name="Money out" fill="#F39A1E" radius={[5, 5, 0, 0]} maxBarSize={22} />
                <Line type="monotone" dataKey="net" name="Net position" stroke="#0B2E46" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 rounded-xl bg-upwa-canvas px-4 py-3 text-xs leading-5 text-slate-600">
            <strong className="text-upwa-navy">What this means:</strong> tall orange bars are payroll weeks — salaries leave the account on the 25th of each
            month. Green bars climb as parents pay; collections normally accelerate in the last month of term, which is when the outstanding balances land.
          </p>
        </Card>

        <Card>
          <CardHeader title="Where the money went" subtitle="This term, by category" icon={<TrendingDown size={18} />} />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={3} strokeWidth={2}>
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLOURS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => naira(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-1 space-y-1.5">
            {donutData.map((entry) => (
              <li key={entry.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLOURS[entry.name] ?? "#94a3b8" }} />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-800">{Math.round((entry.value / brief.spent) * 100)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="The term's money story" subtitle="Everything the school billed, collected and spent since 8 September" icon={<Wallet size={18} />} />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <Meter value={brief.collectionRate} tone="bg-gradient-to-r from-upwa-green-600 to-upwa-green-500" caption={`Of every ₦100 billed, ₦${brief.collectionRate} has been paid`} />
              <Meter value={brief.spendRate} tone="bg-gradient-to-r from-upwa-orange-600 to-upwa-orange-500" caption={`Spending so far equals ${brief.spendRate}% of the term's billing`} />
              <Meter value={brief.termAttendance} tone="bg-gradient-to-r from-upwa-blue-700 to-upwa-blue-500" caption={`Attendance across the term: ${brief.termAttendance}% (target ${settings.attendanceTarget}%)`} />
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                ["Billed to families this term", naira(brief.billed)],
                ["Collected and confirmed", naira(brief.collected)],
                ["Spent on running the school", naira(brief.spent)],
                ["Brought in on the first day of term", naira(settings.openingBalance)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-dashed border-slate-200 pb-2">
                  <dt className="text-xs text-slate-600">{label}</dt>
                  <dd className="font-display text-sm font-bold text-upwa-navy">{value}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-3 rounded-xl bg-upwa-navy px-4 py-3 text-white">
                <dt className="text-xs font-semibold text-slate-300">In the school account today</dt>
                <dd className="font-display text-lg font-bold">{naira(brief.cash)}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-4 rounded-xl bg-upwa-canvas px-4 py-3 text-xs leading-5 text-slate-600">
            <strong className="text-upwa-navy">In plain words:</strong> the school has taken {brief.collectionRate} kobo of every naira it billed and has already
            paid for {brief.spendRate} kobo of it. The account still holds {compactNaira(brief.cash)} because the term opened with {compactNaira(settings.openingBalance)};
            the {compactNaira(brief.overdueValue)} owed by overdue families is what closes the gap before December payroll.
          </p>
        </Card>

        <Card padded={false}>
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-display text-base font-bold text-upwa-navy">Money still waiting</h3>
            <p className="mt-0.5 text-xs text-slate-500">What has not reached the account yet, and why</p>
          </div>
          <ul className="divide-y divide-slate-100">
            <li className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">Transfers awaiting bursary review</span>
                <span className="font-display text-sm font-bold text-upwa-orange-700">{naira(brief.pending.reduce((s, p) => s + p.amount, 0))}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{brief.pending.length} receipt(s) with evidence uploaded; Mrs. Ameh confirms against the bank statement.</p>
            </li>
            <li className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">Families past their fee date</span>
                <span className="font-display text-sm font-bold text-rose-700">{naira(brief.overdueValue)}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{brief.overdue.length} invoice(s); reminders go out by SMS every Monday morning.</p>
            </li>
            <li className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700">Approved installment balances</span>
                <span className="font-display text-sm font-bold text-upwa-blue-800">{naira(brief.instalmentValue)}</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{brief.instalmentDue.length} family(ies) on plan, due {formatDate(settings.termEndDate)} — not yet late.</p>
            </li>
          </ul>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-upwa-navy">Latest spending</h3>
            <p className="mt-0.5 text-xs text-slate-500">The most recent payments out of the school account</p>
          </div>
          <Badge tone="neutral">{data.expenses.length} entries this term</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">What it was for</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Approved by</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topSpends.map((expense) => (
                <tr key={expense.id} className="transition-colors hover:bg-upwa-canvas/50">
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">{formatDate(expense.date)}</td>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-slate-800">{expense.description}</p>
                    <p className="text-[11px] text-slate-500">Paid to {expense.paidTo}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white" style={{ background: CATEGORY_COLOURS[expense.category] ?? "#64748b" }}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{expense.department}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">{expense.approvedBy}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right font-display text-sm font-bold text-upwa-navy">{naira(expense.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ------------------------------ daily brief ------------------------------ */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={closeOfWork ? "Today, at the close of work" : "Today so far"}
            subtitle={`${weekdayOf(brief.latestRegister)}, ${formatLongDate(brief.latestRegister)} · written the way you would say it`}
            icon={<Sparkles size={18} />}
            action={<Badge tone={closeOfWork ? "green" : "orange"}>{closeOfWork ? "Brief ready" : "Updates at 4:00 PM"}</Badge>}
          />
          <ul className="space-y-4">
            {[
              { icon: CalendarCheck, tone: "border-upwa-green-500 bg-upwa-green-50 text-upwa-green-800", title: "Pupils & attendance", body: `${brief.present} pupils present, ${brief.late} late, ${brief.absent} absent and ${brief.excused} excused — ${brief.attendanceRate}% of the roll, against a term average of ${brief.termAttendance}%. ${brief.attendanceRate >= settings.attendanceTarget ? "Above the target you set." : `Below your ${settings.attendanceTarget}% target; class teachers have been asked to follow up.`}` },
              { icon: Wallet, tone: "border-upwa-blue-500 bg-upwa-blue-50 text-upwa-blue-800", title: "The bursary", body: `${naira(brief.paidToday.reduce((s, p) => s + p.amount, 0))} was banked from ${brief.paidToday.length} payment(s). ${brief.spentToday.length ? `${naira(brief.spentToday.reduce((s, e) => s + e.amount, 0))} went out: ${brief.spentToday.map((e) => e.description.toLowerCase()).join("; ")}.` : "Nothing was spent."} ${brief.pending.length} transfer(s) are still awaiting confirmation.` },
              { icon: Inbox, tone: "border-upwa-orange-500 bg-upwa-orange-50 text-upwa-orange-800", title: "Admissions", body: `${brief.thisWeek.applications} new application(s) this week. ${data.applications.filter((a) => a.status === "OFFER_MADE").length} family(ies) are holding offers, and ${data.applications.filter((a) => a.status === "ENROLLED").length} applicant(s) have already become pupils.` },
              { icon: School, tone: "border-violet-500 bg-violet-50 text-violet-800", title: "Classroom", body: `${brief.marksOnFile} marks are on file across ${brief.subjects} subjects this term, and report cards are ready to print for any class. ${brief.thisWeek.registers} class register(s) have been closed this week.` },
              { icon: Activity, tone: "border-rose-400 bg-rose-50 text-rose-700", title: "Around the school", body: `${brief.thisWeek.events ? `${brief.thisWeek.events} event(s) took place this week. ` : ""}${brief.thisWeek.messages} broadcast(s) reached parents. Next on the calendar: ${brief.events.filter((e) => e.date >= brief.today)[0]?.title ?? "nothing scheduled"} on ${formatDate(brief.events.filter((e) => e.date >= brief.today)[0]?.date ?? brief.today)}.` },
            ].map((item, index) => (
              <li key={item.title} className="animate-fade-up flex gap-4" style={{ animationDelay: `${index * 70}ms` }}>
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-l-4 ${item.tone}`}>
                  <item.icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-upwa-navy">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-slate-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-upwa-orange-200 bg-upwa-orange-50/60">
          <CardHeader title="For your attention" subtitle="Only what truly needs the President's eye" icon={<AlertTriangle size={18} />} />
          <ul className="space-y-3">
            {brief.attention.map((item, index) => (
              <li
                key={item.text}
                className={`animate-fade-up rounded-2xl border-l-4 bg-white px-4 py-3 text-[13px] leading-6 text-slate-700 shadow-sm ${
                  item.tone === "red" ? "border-rose-500" : item.tone === "orange" ? "border-upwa-orange-500" : "border-upwa-blue-500"
                }`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ------------------------------ departments ------------------------------ */}
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold text-upwa-navy">Every department, at a glance</h3>
            <p className="mt-1 text-sm text-slate-600">What is happening within and around each part of the school today.</p>
          </div>
          <Badge tone="neutral">{brief.registerIsToday ? `Register of ${formatDate(brief.latestRegister)}` : `Latest register: ${formatDate(brief.latestRegister)}`}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {brief.academicDepartments.map((department, index) => (
            <div
              key={department.name}
              className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel-lg"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${department.tone}`}>
                  <department.icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold text-upwa-navy">{department.name}</p>
                  <p className="text-[11px] text-slate-500">{department.roll} pupils on roll</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <Meter value={department.rate} tone="bg-upwa-green-500" caption="In school today" />
                <Meter value={department.feesRate} tone="bg-upwa-blue-600" caption="Of their fees paid" />
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-600">
                {department.rate >= 90 ? "Almost a full house today." : department.rate >= 80 ? "A few absentees; follow-up underway." : "Attendance needs a push this week."}{" "}
                {compactNaira(Math.max(0, department.outstanding))} still outstanding from these families.
              </p>
            </div>
          ))}
          {brief.offices.map((office, index) => (
            <div
              key={office.name}
              className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel-lg"
              style={{ animationDelay: `${(index + 4) * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${office.tone}`}>
                  <office.icon size={18} />
                </span>
                <p className="min-w-0 truncate font-display text-base font-bold text-upwa-navy">{office.name}</p>
              </div>
              <p className="mt-4 font-display text-lg font-bold text-upwa-navy">{office.headline}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-600">{office.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------- weekly comprehensive --------------------------- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-upwa-blue-900 via-upwa-navy to-upwa-midnight p-6 text-white shadow-panel-lg sm:p-8">
        <div aria-hidden="true" className="pattern-dots pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-upwa-orange-400">
                <Clock3 size={13} /> Every Friday, 6:00 PM
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">The weekly comprehensive report</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                One document that tells the whole week: attendance against last week, every naira in and out, each department&apos;s position, admissions movement
                and the watch-list. It lands in your inbox as a PDF at 6:00 PM every Friday — last delivered {formatLongDate(iso(brief.lastFriday))}, next on{" "}
                {formatLongDate(iso(brief.nextFriday))}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="accent" size="sm" icon={<FileDown size={15} />} onClick={() => downloadPdf("weekly")} disabled={building !== ""}>
                {building === "weekly" ? "Building PDF…" : "This week's PDF"}
              </Button>
              <Button variant="ghost" size="sm" className="!border !border-white/25 !bg-white/10 !text-white hover:!bg-white/20" icon={<FileDown size={15} />} onClick={() => downloadPdf("daily")} disabled={building !== ""}>
                {building === "daily" ? "Building…" : "Today's brief PDF"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="!border !border-white/25 !bg-white/10 !text-white hover:!bg-white/20"
                icon={<Send size={15} />}
                onClick={() => emailNow("daily")}
                disabled={building !== ""}
              >
                {building === "daily" ? "Sending…" : "Email today's brief"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="!border !border-white/25 !bg-white/10 !text-white hover:!bg-white/20"
                icon={<Send size={15} />}
                onClick={() => emailNow("weekly")}
                disabled={building !== ""}
              >
                {building === "weekly" ? "Sending…" : "Email the weekly report"}
              </Button>
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-5">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm lg:col-span-3">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3">The week in numbers</th>
                    <th className="px-4 py-3 text-right">This week</th>
                    <th className="px-4 py-3 text-right">Last week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07] text-slate-200">
                  {[
                    ["Attendance", `${brief.thisWeek.rate}%`, `${brief.lastWeek.rate}%`],
                    ["Money in", naira(brief.thisWeek.income), naira(brief.lastWeek.income)],
                    ["Money out", naira(brief.thisWeek.spend), naira(brief.lastWeek.spend)],
                    ["Class registers closed", String(brief.thisWeek.registers), String(brief.lastWeek.registers)],
                    ["New applications", String(brief.thisWeek.applications), String(brief.lastWeek.applications)],
                    ["Broadcasts to parents", String(brief.thisWeek.messages), String(brief.lastWeek.messages)],
                    ["Events held", String(brief.thisWeek.events), String(brief.lastWeek.events)],
                  ].map(([label, now, before]) => (
                    <tr key={label}>
                      <td className="px-4 py-2.5 text-xs text-slate-300">{label}</td>
                      <td className="px-4 py-2.5 text-right font-display text-sm font-bold text-white">{now}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-400">{before}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-2">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Delivery log · {settings.presidentEmail}</p>
              <ul className="space-y-2.5">
                {[...brief.log].reverse().slice(0, 5).map((entry) => (
                  <li key={`${entry.kind}-${entry.at}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5">
                    {entry.state === "delivered" ? (
                      <CheckCircle2 size={15} className="shrink-0 text-upwa-green-300" />
                    ) : (
                      <Clock3 size={15} className="shrink-0 text-upwa-orange-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
                        {entry.kind === "weekly" ? "Weekly comprehensive report" : "Daily close-of-work brief"}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {weekdayOf(iso(new Date(entry.at)))}, {formatDate(iso(new Date(entry.at)))} ·{" "}
                        {new Date(entry.at).getHours() === 18 ? "6:00 PM" : "4:00 PM"}
                      </p>
                    </div>
                    <Badge tone={entry.state === "delivered" ? "green" : "orange"}>{entry.state === "delivered" ? "Delivered" : "Scheduled"}</Badge>
                  </li>
                ))}
                {manualSends.slice(-3).reverse().map((send, index) => (
                  <li key={`${send.at.getTime()}-${index}`} className="flex items-center gap-3 rounded-xl border border-upwa-orange-400/30 bg-upwa-orange-500/10 px-3.5 py-2.5">
                    <Mail size={15} className="shrink-0 text-upwa-orange-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
                        {send.kind === "weekly" ? "Weekly report" : "Daily brief"} {send.channel === "provider" ? "emailed on request" : "requested — saved locally"}
                      </p>
                      <p className="truncate text-[10px] text-slate-400">
                        {settings.presidentEmail} · {send.channel === "provider" ? "delivered by the school's mail provider" : "no mail provider connected yet"}
                      </p>
                    </div>
                    <Badge tone={send.channel === "provider" ? "green" : "orange"}>{send.channel === "provider" ? "Sent" : "Saved"}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <p className="px-1 text-[11px] leading-5 text-slate-500">
        Every figure above is drawn live from the school&apos;s own registers, bursary ledger and office records for {settings.session},{" "}
        {termLabel(settings.currentTerm)}. Nothing on this page can be edited — when the school team updates a register, confirms a transfer or logs an
        application, this brief rewrites itself. The two PDFs are mailed on their own schedule by the school&apos;s report service — the buttons above send
        the copy you are looking at, whenever you ask for it.
      </p>
    </div>
  );
}
