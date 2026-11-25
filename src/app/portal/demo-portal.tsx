"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  BookMarked,
  Crown,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  GraduationCap,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  RotateCcw,
  School,
  Search,
  Settings2,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { DemoProvider, useDemo } from "./demo/store";
import { Badge, Button, ToastStack } from "./demo/ui";
import { OverviewWorkspace } from "./demo/workspaces/overview";
import { PresidentWorkspace } from "./demo/workspaces/president";
import { AdmissionsWorkspace, GuardiansWorkspace, StaffWorkspace, StudentsWorkspace } from "./demo/workspaces/people";
import { AttendanceWorkspace, GradebookWorkspace, ResultsWorkspace } from "./demo/workspaces/academics";
import { FinanceWorkspace } from "./demo/workspaces/finance";
import { CalendarWorkspace, CommunicationsWorkspace, SettingsWorkspace, SubjectsWorkspace } from "./demo/workspaces/engagement";
import { termLabel } from "./demo/format";

type ModuleKey =
  | "president"
  | "overview"
  | "students"
  | "guardians"
  | "staff"
  | "admissions"
  | "attendance"
  | "gradebook"
  | "results"
  | "subjects"
  | "finance"
  | "communications"
  | "calendar"
  | "settings";

const MODULES: { key: ModuleKey; label: string; group: string; icon: typeof Users; blurb: string }[] = [
  { key: "president", label: "President's Office", group: "President's Office", icon: Crown, blurb: "Dr. Chike's read-only brief: the whole school in plain words — money in and out, every department, and what needs her eye. PDFs daily at 4:00 PM and Fridays at 6:00 PM." },
  { key: "overview", label: "Overview", group: "Dashboard", icon: LayoutDashboard, blurb: "Today's snapshot of enrolment, attendance, fees and admissions." },
  { key: "students", label: "Pupils", group: "People", icon: Users, blurb: "The pupil register: enrol, edit, view the full record and withdraw." },
  { key: "guardians", label: "Parents & guardians", group: "People", icon: HeartHandshake, blurb: "Contact records used for broadcasts, pickup and fee reminders." },
  { key: "staff", label: "Staff", group: "People", icon: School, blurb: "Teaching and non-teaching staff, roles and subject assignments." },
  { key: "admissions", label: "Admissions", group: "People", icon: UserPlus, blurb: "Move applicants through the pipeline and convert offers into pupils." },
  { key: "attendance", label: "Attendance", group: "Academics", icon: CalendarCheck, blurb: "Take the daily register per class and arm, then save it." },
  { key: "gradebook", label: "Gradebook", group: "Academics", icon: ClipboardCheck, blurb: "Enter CA1, CA2 and examination marks; totals and grades compute live." },
  { key: "results", label: "Report cards", group: "Academics", icon: FileText, blurb: "Preview the terminal report a parent receives, with positions and remarks." },
  { key: "subjects", label: "Subjects", group: "Academics", icon: BookMarked, blurb: "Curriculum configuration: codes, levels, classes and assigned teachers." },
  { key: "finance", label: "Fees & payments", group: "Bursary", icon: Wallet, blurb: "Invoices, the payment ledger, transfer review and the fee structure." },
  { key: "communications", label: "Communications", group: "Engagement", icon: MessageSquareText, blurb: "Compose, schedule and review SMS and email broadcasts." },
  { key: "calendar", label: "Calendar & events", group: "Engagement", icon: CalendarDays, blurb: "Term dates, examinations, ceremonies and the events parents see." },
  { key: "settings", label: "Settings", group: "Administration", icon: Settings2, blurb: "Session, term dates, grading scheme and demonstration controls." },
];

const GROUPS = ["President's Office", "Dashboard", "People", "Academics", "Bursary", "Engagement", "Administration"];

const GROUP_ICON: Record<string, typeof Users> = {
  "President's Office": Crown,
  Dashboard: LayoutDashboard,
  People: Users,
  Academics: GraduationCap,
  Bursary: Wallet,
  Engagement: Inbox,
  Administration: Settings2,
};

function WorkspaceShell() {
  const { data, ready, toasts, dismissToast, reset } = useDemo();
  const [active, setActive] = useState<ModuleKey>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Deep links (#students, #finance…) so a tab survives refresh or a shared link.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as ModuleKey;
    if (MODULES.some((module) => module.key === hash)) setActive(hash);
  }, []);

  function navigate(key: ModuleKey) {
    setActive(key);
    setMobileNav(false);
    setQuery("");
    window.history.replaceState(null, "", `#${key}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return MODULES.filter((module) => `${module.label} ${module.group} ${module.blurb}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [query]);

  const module = MODULES.find((item) => item.key === active) ?? MODULES[0];
  const settings = data?.settings;

  const pendingPayments = data?.payments.filter((payment) => payment.status === "PENDING_REVIEW").length ?? 0;
  const awaitingApplications = data?.applications.filter((application) => ["SUBMITTED", "UNDER_REVIEW"].includes(application.status)).length ?? 0;
  const alerts = pendingPayments + awaitingApplications;

  if (!ready || !data || !settings) {
    return (
      <main className="surface-navy flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/95 p-2.5 shadow-panel-lg">
            <Image src="/upwa-logo.png" alt="" width={180} height={200} className="h-full w-full object-contain" />
          </span>
          <p className="mt-6 font-display text-lg font-bold text-white">UPWA International Schools</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-upwa-orange-400">Management system</p>
          <p className="mt-5 text-sm text-slate-300">Preparing the demonstration workspace…</p>
          <span className="mx-auto mt-5 block h-1 w-40 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full w-1/2 animate-[drift_1.2s_ease-in-out_infinite] rounded-full bg-upwa-orange-500" />
          </span>
        </div>
      </main>
    );
  }

  function renderWorkspace() {
    switch (active) {
      case "president":
        return <PresidentWorkspace />;
      case "students":
        return <StudentsWorkspace />;
      case "guardians":
        return <GuardiansWorkspace />;
      case "staff":
        return <StaffWorkspace />;
      case "admissions":
        return <AdmissionsWorkspace />;
      case "attendance":
        return <AttendanceWorkspace />;
      case "gradebook":
        return <GradebookWorkspace />;
      case "results":
        return <ResultsWorkspace />;
      case "subjects":
        return <SubjectsWorkspace />;
      case "finance":
        return <FinanceWorkspace />;
      case "communications":
        return <CommunicationsWorkspace />;
      case "calendar":
        return <CalendarWorkspace />;
      case "settings":
        return <SettingsWorkspace />;
      default:
        return <OverviewWorkspace onNavigate={(key) => navigate(key as ModuleKey)} />;
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5">
          <Image src="/upwa-logo.png" alt="UPWA crest" width={180} height={200} className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-white">UPWA-ISMS</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-upwa-orange-400">School workspace</p>
        </div>
        <button type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden">
          <X size={18} />
        </button>
      </div>

      <div className="mx-4 mb-4 rounded-2xl border border-upwa-orange-400/25 bg-upwa-orange-500/10 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-upwa-orange-400">
          <Sparkles size={12} /> Demonstration data
        </p>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-300">
          Realistic but fictional pupils, marks and payments. Saved in this browser only — the school database is never touched.
        </p>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6" aria-label="Portal modules">
        {GROUPS.map((group) => {
          const GroupIcon = GROUP_ICON[group];
          const items = MODULES.filter((item) => item.group === group);
          return (
            <div key={group}>
              <p className="mb-1.5 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                <GroupIcon size={12} /> {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const selected = item.key === active;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => navigate(item.key)}
                        aria-current={selected ? "page" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-all duration-200 ${
                          selected
                            ? "bg-white font-semibold text-upwa-navy shadow-panel"
                            : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                        }`}
                      >
                        <item.icon size={17} className={selected ? "text-upwa-blue-700" : "text-slate-400"} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {selected ? <span className="h-1.5 w-1.5 rounded-full bg-upwa-orange-500" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-upwa-orange-500 text-xs font-bold text-upwa-midnight">NO</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">Mrs. Ndidi Okeke</p>
            <p className="truncate text-[10px] text-slate-400">Head Teacher · full access</p>
          </div>
          <button type="button" onClick={reset} aria-label="Reset demonstration data" title="Reset demonstration data" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      {mobileNav ? (
        <button type="button" aria-label="Close menu backdrop" onClick={() => setMobileNav(false)} className="fixed inset-0 z-40 bg-upwa-midnight/60 backdrop-blur-sm lg:hidden" />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[276px] transform bg-upwa-midnight transition-transform duration-300 ease-out-expo lg:translate-x-0 ${
          mobileNav ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <div className="lg:pl-[276px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/[0.92] backdrop-blur-xl">
          <div className="flex min-h-[68px] items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50 lg:hidden">
              <Menu size={19} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-500">
                <span>UPWA International Schools</span>
                <ChevronRight size={11} className="shrink-0 text-slate-300" />
                <span>{module.group}</span>
              </p>
              <h1 className="truncate font-display text-lg font-bold text-upwa-navy">{module.label}</h1>
            </div>

            <div className="relative hidden md:block">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modules…"
                aria-label="Search modules"
                className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
              />
              {matches.length > 0 ? (
                <ul className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel-lg">
                  {matches.map((item) => (
                    <li key={item.key}>
                      <button type="button" onClick={() => navigate(item.key)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-upwa-canvas">
                        <item.icon size={16} className="mt-0.5 shrink-0 text-upwa-blue-700" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-upwa-navy">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{item.blurb}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => navigate("finance")}
              aria-label={`${alerts} items need attention`}
              className="relative rounded-xl border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Bell size={18} />
              {alerts > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-upwa-orange-500 px-1 text-[10px] font-bold text-upwa-midnight">
                  {alerts}
                </span>
              ) : null}
            </button>

            <div className="hidden items-center gap-2 rounded-xl bg-upwa-orange-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-upwa-orange-900 sm:flex">
              <Sparkles size={13} /> Demo
            </div>

            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 xl:flex"
            >
              Website <ExternalLink size={13} />
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-7">
          {!bannerDismissed ? (
            <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-upwa-blue-200 bg-white p-5 shadow-panel sm:flex-row sm:items-center">
              <div className="flex flex-1 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-blue-50 text-upwa-blue-800">
                  <Sparkles size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-upwa-navy">Interactive demonstration · {settings.session}, {termLabel(settings.currentTerm)}</p>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
                    Every pupil, parent, mark, invoice and message here is fictional but behaves exactly like the live
                    product: records can be created, viewed, edited and deleted, and your changes persist in this browser
                    until you reset them. No school database is connected and nothing is sent anywhere.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="orange">{data.students.length} pupils</Badge>
                <Button variant="ghost" size="sm" onClick={() => setBannerDismissed(true)} aria-label="Dismiss introduction">
                  <X size={15} />
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mb-5">
            <p className="text-sm leading-6 text-slate-600">{module.blurb}</p>
          </div>

          {renderWorkspace()}

          <footer className="mt-9 flex flex-col gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>UPWA-ISMS · demonstration workspace · {settings.session} {termLabel(settings.currentTerm)}</span>
            <span className="flex flex-wrap items-center gap-3">
              <span>Fictional data only</span>
              <button type="button" onClick={reset} className="font-semibold text-upwa-blue-700 hover:underline">
                Reset demonstration
              </button>
            </span>
          </footer>
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

/**
 * Public demonstration of the UPWA International Schools Management System.
 *
 * Deliberately creates no Supabase client and calls no portal API: it shows the
 * client how the finished product behaves using a realistic synthetic dataset
 * that lives only in the browser.
 */
export default function DemoPortal() {
  return (
    <DemoProvider>
      <WorkspaceShell />
    </DemoProvider>
  );
}
