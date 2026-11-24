"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";

type DemoView = "overview" | "learners" | "attendance" | "results" | "admissions" | "finance" | "website";

const navigation: { id: DemoView; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "learners", label: "Learners", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "results", label: "Results", icon: GraduationCap },
  { id: "admissions", label: "Admissions", icon: ClipboardList },
  { id: "finance", label: "Finance", icon: CreditCard },
  { id: "website", label: "Website", icon: Megaphone },
];

const metrics = [
  { label: "Enrolment", value: "1,248", detail: "illustrative learners", color: "text-upwa-blue-800" },
  { label: "Attendance", value: "94%", detail: "illustrative today", color: "text-upwa-green-800" },
  { label: "Applications", value: "23", detail: "illustrative in review", color: "text-upwa-orange-800" },
  { label: "Fees collected", value: "₦8.4m", detail: "illustrative total", color: "text-upwa-blue-800" },
];

const learners = [
  { id: "DEMO-001", name: "Sample Learner A", className: "Primary 4", status: "Active" },
  { id: "DEMO-002", name: "Sample Learner B", className: "JSS 2", status: "Active" },
  { id: "DEMO-003", name: "Sample Learner C", className: "Nursery", status: "Active" },
];

const applications = [
  { id: "DEMO-APP-01", applicant: "Demo Applicant A", division: "Primary / Early Years", status: "Under review" },
  { id: "DEMO-APP-02", applicant: "Demo Applicant B", division: "Secondary", status: "Submitted" },
  { id: "DEMO-APP-03", applicant: "Demo Applicant C", division: "Primary / Early Years", status: "Exam scheduled" },
];

export default function PublicDemoWorkspace() {
  const [view, setView] = useState<DemoView>("overview");
  const active = navigation.find((item) => item.id === view)!;

  return (
    <main className="min-h-screen bg-upwa-canvas text-slate-800">
      <header className="border-t-4 border-t-upwa-orange-500 bg-upwa-navy text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-12 w-11 object-contain" />
            <div>
              <p className="font-bold">UPWA International Schools</p>
              <p className="text-xs text-slate-300">Management portal · public demo</p>
            </div>
          </div>
          <Link href="/" className="rounded-lg border border-white/25 px-3 py-2 text-sm font-medium hover:bg-white/10">Back to website</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section role="note" className="mb-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Demonstration only — no sign-in required</p>
            <p className="mt-1 text-sm leading-5">All figures and records on this page are fictional examples for presentation. This read-only demo is not connected to the school database.</p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Portal modules</p>
            <nav aria-label="Demo portal modules" className="grid gap-1">
              {navigation.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" aria-current={view === id ? "page" : undefined} onClick={() => setView(id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${view === id ? "bg-upwa-blue-50 text-upwa-blue-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />{label}
                </button>
              ))}
            </nav>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Read-only preview.</span> Actions that would create or change school records are disabled.</div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-upwa-blue-700">School administration</p>
                <h1 className="mt-1 text-2xl font-bold text-upwa-navy">{active.label}</h1>
                <p className="mt-1 text-sm text-slate-600">A preview of the role-based school portal experience.</p>
              </div>
              <span className="rounded-full bg-upwa-green-50 px-3 py-1.5 text-xs font-semibold text-upwa-green-800">DEMO · READ ONLY</span>
            </div>

            {view === "overview" && <Overview />}
            {view === "learners" && <Learners />}
            {view === "attendance" && <Attendance />}
            {view === "results" && <Results />}
            {view === "admissions" && <Admissions />}
            {view === "finance" && <Finance />}
            {view === "website" && <Website />}
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-500">
          <span>UPWA International Schools · Prototype demonstration</span>
          <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-upwa-blue-800 hover:underline">Staff sign-in <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}

function Overview() {
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p><p className={`mt-3 text-2xl font-bold ${metric.color}`}>{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-upwa-blue-700" aria-hidden="true" /><h2 className="font-bold text-upwa-navy">Recent activity</h2></div><div className="mt-4 divide-y divide-slate-100">{["Demo attendance register reviewed", "Sample application moved to review", "Illustrative results sheet prepared"].map((item, index) => <div key={item} className="flex justify-between gap-3 py-3 text-sm"><span>{item}</span><span className="shrink-0 text-xs text-slate-500">{index + 1}h ago</span></div>)}</div></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-upwa-blue-700" aria-hidden="true" /><h2 className="font-bold text-upwa-navy">Division snapshot</h2></div><div className="mt-4 space-y-4">{[{ name: "Primary / Early Years", count: "760 sample learners" }, { name: "Secondary", count: "488 sample learners" }].map((division) => <div key={division.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="text-sm font-medium">{division.name}</span><span className="text-sm font-semibold text-upwa-blue-800">{division.count}</span></div>)}</div></article>
    </div>
  </div>;
}

function Learners() {
  return <DataTable title="Learner register · sample records" headers={["Demo ID", "Learner", "Class", "Status"]} rows={learners.map((learner) => [learner.id, learner.name, learner.className, learner.status])} />;
}

function Attendance() {
  return <DataTable title="Attendance · sample records" headers={["Demo ID", "Learner", "Date", "Status"]} rows={[["DEMO-001", "Sample Learner A", "Today", "Present"], ["DEMO-002", "Sample Learner B", "Today", "Late"], ["DEMO-003", "Sample Learner C", "Today", "Present"]]} />;
}

function Results() {
  return <DataTable title="Results overview · sample records" headers={["Demo ID", "Learner", "Subject", "Progress"]} rows={[["DEMO-001", "Sample Learner A", "Mathematics", "In progress"], ["DEMO-002", "Sample Learner B", "English", "Reviewed"], ["DEMO-003", "Sample Learner C", "Basic Science", "Draft"]]} />;
}

function Admissions() {
  return <DataTable title="Admissions pipeline · sample records" headers={["Demo reference", "Applicant", "Division", "Status"]} rows={applications.map((application) => [application.id, application.applicant, application.division, application.status])} />;
}

function Finance() {
  return <div className="grid gap-4 sm:grid-cols-2"><DemoCard title="Illustrative billing" value="₦12.6m" note="Sample total only" /><DemoCard title="Illustrative collections" value="₦8.4m" note="Sample total only" /><DemoCard title="Illustrative outstanding" value="₦4.2m" note="Sample total only" /><DemoCard title="Payment controls" value="Two-step review" note="Workflow preview; no payments can be made" /></div>;
}

function Website() {
  return <div className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Megaphone className="h-5 w-5 text-upwa-blue-700" aria-hidden="true" /><div><h2 className="font-bold text-upwa-navy">School news</h2><p className="text-xs text-slate-500">Illustrative draft</p></div></div><p className="mt-4 text-sm text-slate-600">An example content card showing how reviewed school updates can be organised.</p><button type="button" disabled className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400">Publishing disabled in demo</button></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-upwa-orange-700" aria-hidden="true" /><div><h2 className="font-bold text-upwa-navy">Academic information</h2><p className="text-xs text-slate-500">Illustrative draft</p></div></div><p className="mt-4 text-sm text-slate-600">Approved curriculum details can be presented to families through the school website CMS.</p><button type="button" disabled className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-400">Editing disabled in demo</button></article></div>;
}

function DemoCard({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-3 text-2xl font-bold text-upwa-navy">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 p-5 font-bold text-upwa-navy">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-5 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`px-5 py-3 ${index === 0 ? "font-mono text-xs text-slate-500" : "text-slate-700"}`}>{cell}</td>)}</tr>)}</tbody></table></div><p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Sample content for demonstration only. No real school records are shown.</p></section>;
}
