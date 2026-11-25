"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Inbox,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useDemo } from "../store";
import { Badge, Button, Card, CardHeader, StatCard, StatusBadge } from "../ui";
import { CLASS_ORDER, divisionOfClass } from "../types";
import {
  attendanceSummary,
  compactNaira,
  confirmedPayments,
  formatDate,
  fullName,
  gradeFor,
  invoiceStatus,
  invoiceTotal,
  naira,
  relativeDay,
  scoreTotal,
  termLabel,
} from "../format";

const CHART_COLOURS = ["#0789B8", "#F39A1E", "#26894D", "#7C3AED", "#0B2E46", "#DB2777"];

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 12px 32px -12px rgba(11,46,70,0.25)",
} as const;

export function OverviewWorkspace({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { data } = useDemo();

  const metrics = useMemo(() => {
    if (!data) return null;
    const { students, guardians, staff, attendance, scores, invoices, payments, applications, events, settings } = data;

    const active = students.filter((student) => student.status === "ACTIVE");
    const today = attendance.length
      ? Array.from(new Set(attendance.map((record) => record.date))).sort((a, b) => b.localeCompare(a))[0]
      : "";
    const todayRecords = attendance.filter((record) => record.date === today);
    const todaySummary = attendanceSummary(todayRecords);

    const billed = invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
    const collected = payments.filter((payment) => payment.status === "CONFIRMED").reduce((sum, payment) => sum + payment.amount, 0);
    const pending = payments.filter((payment) => payment.status === "PENDING_REVIEW");

    const enrolmentByClass = CLASS_ORDER.map((className) => ({
      name: className.replace("Pre-Nursery", "Pre-Nur.").replace("Nursery ", "Nur. "),
      pupils: active.filter((student) => student.className === className).length,
    })).filter((row) => row.pupils > 0);

    const dates = Array.from(new Set(attendance.map((record) => record.date))).sort();
    const attendanceTrend = dates.slice(-10).map((date) => {
      const summary = attendanceSummary(attendance.filter((record) => record.date === date));
      return { name: formatDate(date).replace(/^\d+ /, "").slice(0, 6), rate: summary.rate, absent: summary.absent };
    });

    const gradeBuckets = settings.grading.map((band) => ({ name: band.grade, pupils: 0 }));
    scores.forEach((score) => {
      const grade = gradeFor(scoreTotal(score), settings.grading);
      const bucket = gradeBuckets.find((item) => item.name === grade.grade);
      if (bucket) bucket.pupils += 1;
    });

    const invoiceBreakdown = [
      { name: "Cleared", value: invoices.filter((invoice) => invoiceStatus(invoice, payments) === "PAID").length },
      { name: "Part paid", value: invoices.filter((invoice) => invoiceStatus(invoice, payments) === "PART_PAYMENT").length },
      { name: "Outstanding", value: invoices.filter((invoice) => ["OUTSTANDING", "OVERDUE"].includes(invoiceStatus(invoice, payments))).length },
    ].filter((row) => row.value > 0);

    const collectionsByLevel = ["Crèche / Nursery", "Primary", "Junior Secondary", "Senior Secondary"].map((label) => {
      const matches = invoices.filter((invoice) => {
        const student = students.find((item) => item.id === invoice.studentId);
        if (!student) return false;
        const division = divisionOfClass(student.className);
        if (label === "Crèche / Nursery") return division === "PRIMARY_EARLY_YEARS" && !student.className.startsWith("Primary");
        if (label === "Primary") return student.className.startsWith("Primary");
        return division === "SECONDARY" && student.className.startsWith(label === "Junior Secondary" ? "JSS" : "SSS");
      });
      return {
        name: label.replace("Junior Secondary", "JSS").replace("Senior Secondary", "SSS").replace("Crèche / Nursery", "Early yrs"),
        collected: matches.reduce((sum, invoice) => sum + confirmedPayments(payments, invoice.id), 0),
        outstanding: matches.reduce((sum, invoice) => sum + Math.max(0, invoiceTotal(invoice) - confirmedPayments(payments, invoice.id)), 0),
      };
    });

    const recentPayments = [...payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 5);
    const recentApplications = [...applications].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 4);
    const upcomingEvents = [...events].filter((event) => event.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

    return {
      settings,
      active,
      guardians,
      staff,
      today,
      todaySummary,
      billed,
      collected,
      pending,
      enrolmentByClass,
      attendanceTrend,
      gradeBuckets: gradeBuckets.filter((bucket) => bucket.pupils > 0),
      invoiceBreakdown,
      collectionsByLevel,
      recentPayments,
      recentApplications,
      upcomingEvents,
      students,
      applications,
    };
  }, [data]);

  if (!data || !metrics) {
    return <p className="py-10 text-center text-sm text-slate-500">Preparing the demonstration workspace…</p>;
  }

  const { settings } = data;
  const collectionRate = metrics.billed ? Math.round((metrics.collected / metrics.billed) * 100) : 0;
  const girls = metrics.active.filter((student) => student.gender === "FEMALE").length;

  return (
    <div className="space-y-5">
      {/* Term banner */}
      <section className="surface-navy relative overflow-hidden rounded-3xl px-6 py-7 text-white shadow-panel-lg sm:px-8 sm:py-9">
        <div aria-hidden="true" className="pattern-grid pattern-fade pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border-[40px] border-upwa-orange-500/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-upwa-orange-400">
              {termLabel(settings.currentTerm)} · {settings.session}
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold leading-tight sm:text-3xl">
              Good day, Mrs. Chinwe Chike
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {metrics.active.length} pupils are on roll today across {metrics.enrolmentByClass.length} classes.
              {metrics.todaySummary.total > 0
                ? ` The ${formatDate(metrics.today)} register is closed at ${metrics.todaySummary.rate}% attendance.`
                : " Registers for today have not been opened yet."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button variant="accent" size="sm" icon={<CalendarCheck size={15} />} onClick={() => onNavigate("attendance")}>
                Take attendance
              </Button>
              <Button variant="ghost" size="sm" className="!border !border-white/25 !bg-white/10 !text-white hover:!bg-white/20" icon={<ClipboardCheck size={15} />} onClick={() => onNavigate("gradebook")}>
                Enter scores
              </Button>
              <Button variant="ghost" size="sm" className="!border !border-white/25 !bg-white/10 !text-white hover:!bg-white/20" icon={<Wallet size={15} />} onClick={() => onNavigate("finance")}>
                Record a payment
              </Button>
            </div>
          </div>
          <dl className="grid w-full max-w-xs grid-cols-2 gap-3">
            {[
              { label: "Term begins", value: formatDate(settings.termStartDate) },
              { label: "Term ends", value: formatDate(settings.termEndDate) },
              { label: "Pupils", value: String(metrics.active.length) },
              { label: "Attendance", value: `${metrics.todaySummary.rate}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</dt>
                <dd className="mt-1 font-display text-base font-bold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pupils on roll"
          value={String(metrics.active.length)}
          note={`${girls} girls · ${metrics.active.length - girls} boys · ${metrics.guardians.length} parent accounts`}
          icon={<Users size={19} />}
        />
        <StatCard
          label="Attendance today"
          value={`${metrics.todaySummary.rate}%`}
          note={`${metrics.todaySummary.present} present · ${metrics.todaySummary.late} late · ${metrics.todaySummary.absent} absent`}
          icon={<CalendarCheck size={19} />}
          tone="green"
        />
        <StatCard
          label={`Fees collected · ${collectionRate}%`}
          value={compactNaira(metrics.collected)}
          note={`${compactNaira(metrics.billed)} billed · ${compactNaira(Math.max(0, metrics.billed - metrics.collected))} outstanding`}
          icon={<CircleDollarSign size={19} />}
          tone="orange"
        />
        <StatCard
          label="Admissions pipeline"
          value={String(metrics.applications.length)}
          note={`${metrics.applications.filter((a) => a.status === "EXAM_SCHEDULED").length} exams booked · ${metrics.pending.length} payment(s) to review`}
          icon={<Inbox size={19} />}
          tone="violet"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Enrolment by class"
            subtitle={`${settings.session} · active pupils only`}
            icon={<Users size={18} />}
            action={<Button size="sm" variant="ghost" onClick={() => onNavigate("students")}>Open register <ArrowRight size={14} /></Button>}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.enrolmentByClass} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(7,137,184,0.06)" }} />
                <Bar dataKey="pupils" name="Pupils" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {metrics.enrolmentByClass.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLOURS[index % CHART_COLOURS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Invoice status" subtitle="This term's billing across the school" icon={<FileText size={18} />} />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.invoiceBreakdown} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={3} strokeWidth={2}>
                  {metrics.invoiceBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.name === "Cleared" ? "#26894D" : entry.name === "Part paid" ? "#F39A1E" : "#DB2777"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2">
            {metrics.invoiceBreakdown.map((row) => (
              <li key={row.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: row.name === "Cleared" ? "#26894D" : row.name === "Part paid" ? "#F39A1E" : "#DB2777" }}
                  />
                  {row.name}
                </span>
                <span className="font-semibold text-slate-800">{row.value} invoices</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Attendance trend" subtitle="Last 10 school days recorded" icon={<TrendingUp size={18} />} />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.attendanceTrend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#26894D" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#26894D" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="rate" name="Attendance %" stroke="#26894D" strokeWidth={2.5} fill="url(#attendanceFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Collections by level" subtitle="Received against outstanding" icon={<Wallet size={18} />} />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.collectionsByLevel} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(value: number) => compactNaira(value)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => naira(Number(value))} cursor={{ fill: "rgba(7,137,184,0.06)" }} />
                <Bar dataKey="collected" name="Collected" stackId="a" fill="#26894D" radius={[0, 0, 0, 0]} maxBarSize={34} />
                <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill="#F39A1E" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Grade distribution" subtitle="All marks entered this term" icon={<ClipboardCheck size={18} />} />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.gradeBuckets} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(7,137,184,0.06)" }} />
                <Bar dataKey="pupils" name="Marks" radius={[6, 6, 0, 0]} fill="#0789B8" maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Activity */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-bold text-upwa-navy">Latest payments</h3>
              <p className="mt-0.5 text-xs text-slate-500">Bursary receipts, newest first</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("finance")}>View all <ArrowRight size={13} /></Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {metrics.recentPayments.map((payment) => {
              const student = metrics.students.find((item) => item.id === payment.studentId);
              return (
                <li key={payment.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-green-50 text-upwa-green-700">
                    <Wallet size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{student ? fullName(student) : "Pupil"}</p>
                    <p className="truncate text-[11px] text-slate-500">{formatDate(payment.paidAt)} · {payment.bank}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-upwa-navy">{naira(payment.amount)}</p>
                    <StatusBadge status={payment.status} />
                  </div>
                </li>
              );
            })}
            {metrics.recentPayments.length === 0 ? <li className="px-5 py-8 text-center text-sm text-slate-500">No payments recorded yet.</li> : null}
          </ul>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-bold text-upwa-navy">Admissions activity</h3>
              <p className="mt-0.5 text-xs text-slate-500">Newest applications this cycle</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("admissions")}>Pipeline <ArrowRight size={13} /></Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {metrics.recentApplications.map((application) => (
              <li key={application.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-blue-50 text-upwa-blue-700">
                  <UserPlus size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{application.firstName} {application.lastName}</p>
                  <p className="truncate text-[11px] text-slate-500">→ {application.applyingFor} · {formatDate(application.submittedAt)}</p>
                </div>
                <StatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-bold text-upwa-navy">Coming up</h3>
              <p className="mt-0.5 text-xs text-slate-500">School calendar</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate("calendar")}>Calendar <ArrowRight size={13} /></Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {metrics.upcomingEvents.map((event) => (
              <li key={event.id} className="flex items-start gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-upwa-orange-50 text-upwa-orange-800">
                  <CalendarDays size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{event.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{formatDate(event.date)} · {relativeDay(event.date)}</p>
                </div>
                <Badge tone="neutral">{event.type}</Badge>
              </li>
            ))}
            {metrics.upcomingEvents.length === 0 ? <li className="px-5 py-8 text-center text-sm text-slate-500">Nothing scheduled.</li> : null}
          </ul>
        </Card>
      </div>

      {/* Module shortcuts */}
      <Card>
        <CardHeader title="Everyday tasks" subtitle="The workflows staff use most, each opening straight into a working module." icon={<ArrowRight size={18} />} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: "attendance", label: "Mark the register", note: `${metrics.active.length} pupils across ${metrics.enrolmentByClass.length} classes`, icon: CalendarCheck },
            { key: "gradebook", label: "Enter CA & exam marks", note: "Totals and grades calculate live", icon: ClipboardCheck },
            { key: "results", label: "Preview a report card", note: "Positions, remarks and grading key", icon: FileText },
            { key: "finance", label: "Record a fee payment", note: `${metrics.pending.length} transfer(s) awaiting review`, icon: Wallet },
            { key: "admissions", label: "Move an applicant on", note: `${metrics.applications.filter((a) => a.status === "OFFER_MADE").length} offer(s) ready to enrol`, icon: UserPlus },
            { key: "communications", label: "Send a broadcast", note: `${metrics.guardians.length} parent contacts on file`, icon: Inbox },
            { key: "students", label: "Enrol a new pupil", note: "Admission number generated on save", icon: Users },
            { key: "subjects", label: "Adjust the curriculum", note: `${data.subjects.length} subjects configured`, icon: ClipboardCheck },
          ].map((task) => (
            <button
              key={task.key + task.label}
              type="button"
              onClick={() => onNavigate(task.key)}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-upwa-blue-300 hover:shadow-panel"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-canvas text-upwa-blue-800 transition-colors group-hover:bg-upwa-navy group-hover:text-white">
                <task.icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-upwa-navy">{task.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{task.note}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
