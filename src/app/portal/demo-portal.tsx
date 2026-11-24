"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, Bell, BookOpenCheck, CalendarDays, Check, ChevronDown,
  CircleDollarSign, ClipboardList, GraduationCap, LayoutDashboard, Menu, MessageSquareText,
  Plus, Search, Settings2, ShieldCheck, Sparkles, Users, WalletCards, X,
} from "lucide-react";

type ModuleInfo = { name: string; description: string };
type GroupInfo = { name: string; summary: string; modules: ModuleInfo[]; group?: string };

const GROUPS: GroupInfo[] = [
  { name: "School Management", summary: "Academic structure, records and reporting", modules: [
    { name: "Sessions & Terms", description: "Set up academic sessions, terms and active periods." },
    { name: "Classes", description: "Organise classes, education levels and class arms." },
    { name: "Subjects", description: "Manage subjects offered across levels and classes." },
    { name: "Grading Systems", description: "Configure assessment scales, grades and pass rules." },
    { name: "Behaviour & Skills", description: "Record school-defined behaviour and skill ratings." },
    { name: "Attendance", description: "Record attendance, punctuality and absences." },
    { name: "Subject Scores", description: "Enter and review learner assessment scores." },
    { name: "Comments", description: "Manage subject comments and report observations." },
    { name: "Academic Reports", description: "Prepare progress reports, final reports and broadsheets." },
    { name: "Report PINs", description: "Issue controlled report access and verification codes." },
    { name: "Academic Statistics", description: "Review learning progress and academic trends." },
    { name: "Academic Layouts", description: "Arrange the sections shown on academic documents." },
  ] },
  { name: "Utilities", summary: "School calendar, events and communications", modules: [
    { name: "Calendar", description: "View important dates, activities and appointments." },
    { name: "Event Management", description: "Plan meetings, school events and activities." },
    { name: "Email & SMS", description: "Compose messages for selected demo audiences." },
    { name: "Automated Messages", description: "Preview event-triggered messages and schedules." },
    { name: "Communication Groups", description: "Organise contacts into communication groups." },
    { name: "Communication Contacts", description: "Review demo email and SMS contact records." },
    { name: "Message Statistics", description: "Explore delivery volume and status summaries." },
  ] },
  { name: "Student & Parent", summary: "A family view of learning and school information", modules: [
    { name: "Education Statistics", description: "See a learner's progress overview." },
    { name: "Student Fee Payments", description: "Preview invoices, payment options and receipts." },
    { name: "Student Fee Statements", description: "Review a sample fee statement and balance." },
    { name: "Current Class", description: "View current class and school information." },
    { name: "Student Grade Book", description: "Explore assessments and term progress." },
    { name: "Student Final Reports", description: "Preview a term report for a demo learner." },
  ] },
  { name: "Account & Security", summary: "Profile, preferences and personal account tools", modules: [
    { name: "Account Profile", description: "Review editable demo profile fields." },
    { name: "Account Security", description: "Explore account security controls." },
    { name: "Account Preferences", description: "Preview language and notification preferences." },
    { name: "Account Settings", description: "Review personal account settings." },
    { name: "Digital Wallets", description: "Preview a wallet interface using sample balances." },
    { name: "Notification History", description: "Review sample system notifications." },
    { name: "Payment History", description: "Review sample payment activity." },
  ] },
  { name: "Administration", summary: "Members, admissions and organisational content", modules: [
    { name: "Member Statistics", description: "Explore demo membership counts and trends." },
    { name: "Members", description: "Browse a synthetic member directory." },
    { name: "Add Member", description: "Try a local-only member form." },
    { name: "Import Members", description: "Preview spreadsheet import and validation steps." },
    { name: "Admission Templates", description: "Preview application form fields and sections." },
    { name: "Admission Applications", description: "Review sample admissions pipeline records." },
    { name: "Organisation Profile", description: "Explore school identity and profile settings." },
    { name: "Education Levels", description: "Review sample levels configured for a division." },
    { name: "Contact Information", description: "Preview school contact and support details." },
    { name: "Payment Accounts", description: "Review placeholder payment account settings." },
    { name: "Gallery", description: "Explore a media library preview." },
    { name: "Gallery Groups", description: "Organise sample media into groups." },
    { name: "News", description: "Preview school news and announcements." },
    { name: "News Categories", description: "Organise sample news categories." },
    { name: "Testimonials", description: "Review sample community testimonials." },
    { name: "Testimonial Groups", description: "Organise sample testimonials." },
  ] },
  { name: "Settings & Integrations", summary: "Configuration, document layouts and connections", modules: [
    { name: "App Settings", description: "Review platform and module preferences." },
    { name: "Add-ons", description: "Explore optional integration categories." },
    { name: "API Integration", description: "Preview API connection settings (no secrets shown)." },
    { name: "Payment Platforms", description: "Explore payment provider configuration screens." },
    { name: "Spreadsheet Integration", description: "Preview structured spreadsheet workflows." },
    { name: "Layout Builder", description: "Explore form, report and invoice layout controls." },
  ] },
];

const DEMO_ROWS: Record<string, string[][]> = {
  "Sessions & Terms": [["Demo Session 2026/2027", "First Term", "Current · Demo"], ["Demo Session 2025/2026", "Third Term", "Archived sample"]],
  Classes: [["Demo Primary 1", "Early Years", "Arms A, B"], ["Demo Primary 2", "Primary", "Arm A"], ["Demo JSS 1", "Secondary", "Arms A, B"]],
  Subjects: [["DEMO-ENG", "English Language", "Active sample"], ["DEMO-MTH", "Mathematics", "Active sample"], ["DEMO-SCI", "Basic Science", "Active sample"]],
  Attendance: [["Learner Demo 001", "Demo Primary 2", "Present"], ["Learner Demo 002", "Demo Primary 2", "Late"], ["Learner Demo 003", "Demo JSS 1", "Absent"]],
  "Subject Scores": [["Learner Demo 001", "Mathematics", "78 / 100"], ["Learner Demo 002", "English Language", "84 / 100"], ["Learner Demo 003", "Basic Science", "69 / 100"]],
  Members: [["Learner Demo 001", "Student", "Demo Primary 2"], ["Staff Demo 001", "Teacher", "Primary Division"], ["Parent Demo 001", "Parent / Guardian", "Linked demo learner"]],
  "Admission Applications": [["Applicant Demo 001", "Primary Division", "Under review"], ["Applicant Demo 002", "Secondary Division", "Assessment scheduled"], ["Applicant Demo 003", "Primary Division", "Submitted"]],
  "Student Fee Statements": [["Demo Session 2026/2027", "Sample charges", "₦125,000"], ["Sample payments", "Recorded in demo", "₦75,000"], ["Sample balance", "Not a real account", "₦50,000"]],
  "Email & SMS": [["Demo Families Group", "Email + SMS", "Draft preview"], ["Demo Staff Group", "Email", "Sample audience"], ["Delivery sample", "Sent", "Test data only"]],
  Calendar: [["Demo Assembly", "Monday · 8:00 AM", "School event"], ["Demo Mid-term Break", "Sample date", "Academic calendar"], ["Demo Staff Meeting", "Sample date", "Meeting"]],
};

const GROUP_ICON: Record<string, typeof BookOpenCheck> = {
  "School Management": GraduationCap,
  Utilities: CalendarDays,
  "Student & Parent": Users,
  "Account & Security": ShieldCheck,
  Administration: ClipboardList,
  "Settings & Integrations": Settings2,
};

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

export default function DemoPortal() {
  const [groupName, setGroupName] = useState("Overview");
  const [moduleName, setModuleName] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [customRows, setCustomRows] = useState<Record<string, string[][]>>({});
  const [entry, setEntry] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const selectedGroup = GROUPS.find((group) => group.name === groupName);
  const allModules = useMemo(() => GROUPS.flatMap((group) => group.modules.map((module) => ({ ...module, group: group.name }))), []);
  const matchingModules = allModules.filter((module) => !search || `${module.name} ${module.group} ${module.description}`.toLowerCase().includes(search.toLowerCase()));
  const moduleInfo = allModules.find((module) => module.name === moduleName);
  const rows = [...(customRows[moduleName] ?? DEMO_ROWS[moduleName] ?? [
    ["Sample record 001", "Demo workflow", "Ready to explore"],
    ["Sample record 002", "Prototype view", "Fictional data"],
    ["Sample record 003", "Preview item", "No real account"],
  ])];

  function openGroup(name: string) { setGroupName(name); setModuleName(""); setMobileNav(false); setNotice(""); }
  function openModule(name: string, group: string) { setGroupName(group); setModuleName(name); setNotice(""); setMobileNav(false); }
  function simulateAction(message: string) { setNotice(`${message} — demo only; nothing was sent to a server or saved to school records.`); }

  function addDemoEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = entry.trim();
    if (!clean) return;
    setCustomRows((current) => ({ ...current, [moduleName]: [[clean, "Added in this browser", "Demo only"], ...(current[moduleName] ?? DEMO_ROWS[moduleName] ?? [])] }));
    setEntry("");
    simulateAction("Sample item added");
  }

  const nav = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white"><GraduationCap size={23} /></div>
        <div><p className="text-sm font-bold text-white">UPWA ISMS</p><p className="text-[10px] uppercase tracking-[0.18em] text-blue-200">Prototype workspace</p></div>
        <button onClick={() => setMobileNav(false)} className="ml-auto rounded-lg p-2 text-white lg:hidden" aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="mx-4 mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-blue-200">Demo mode</p><p className="mt-1 text-xs leading-5 text-slate-200">All records are synthetic. No school database is connected to this workspace.</p></div>
      <nav className="space-y-1 px-3 pb-6" aria-label="Demo modules">
        <button onClick={() => openGroup("Overview")} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${groupName === "Overview" ? "bg-white text-upwa-navy font-semibold" : "text-slate-200 hover:bg-white/10"}`}><LayoutDashboard size={17} /> Overview</button>
        {GROUPS.map((group) => { const Icon = GROUP_ICON[group.name]; return <button key={group.name} onClick={() => openGroup(group.name)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${groupName === group.name ? "bg-white text-upwa-navy font-semibold" : "text-slate-200 hover:bg-white/10"}`}><Icon size={17} /> <span className="flex-1">{group.name}</span><ChevronDown size={14} className={groupName === group.name ? "rotate-180" : ""} /></button>; })}
        {selectedGroup && groupName !== "Overview" && <div className="ml-6 mt-1 space-y-1 border-l border-white/15 pl-3">{selectedGroup.modules.map((module) => <button key={module.name} onClick={() => openModule(module.name, selectedGroup.name)} className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${moduleName === module.name ? "bg-upwa-blue-700 text-white" : "text-slate-300 hover:bg-white/10"}`}>{module.name}</button>)}</div>}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-upwa-orange-400 text-xs font-bold text-upwa-navy">DE</div><div><p className="text-xs font-semibold text-white">Demo Explorer</p><p className="text-[10px] text-slate-400">Sample access · no sign-in</p></div></div></div>
    </>
  );

  return <main className="min-h-screen bg-slate-100 text-slate-800">
    {mobileNav && <button aria-label="Close menu backdrop" onClick={() => setMobileNav(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col bg-upwa-navy transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>{nav}</aside>
    <div className="min-h-screen lg:pl-[286px]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[72px] items-center gap-3 px-4 sm:px-7">
          <button onClick={() => setMobileNav(true)} aria-label="Open navigation" className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu size={19} /></button>
          <div className="min-w-0 flex-1"><p className="truncate text-xs text-slate-500">UPWA International Schools <span className="px-1">/</span> {groupName}{moduleName && <><span className="px-1">/</span>{moduleName}</>}</p><h1 className="truncate text-lg font-bold text-upwa-navy">{moduleName || groupName}</h1></div>
          <div className="hidden items-center gap-2 rounded-lg bg-upwa-orange-50 px-3 py-2 text-xs font-semibold text-upwa-orange-900 sm:flex"><Sparkles size={14} /> Interactive demo</div>
          <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-upwa-blue-100 text-xs font-bold text-upwa-blue-900 sm:flex">DE</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] p-4 sm:p-7">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-upwa-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-upwa-blue-50 text-upwa-blue-800"><ShieldCheck size={19} /></div><div><p className="text-sm font-bold text-upwa-navy">Public prototype · no account needed</p><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Every name, score, fee and message shown here is fictional sample content. Buttons only change this preview in your browser; no real school data is read, sent or saved.</p></div></div>
          <div className="shrink-0 rounded-full bg-upwa-green-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-upwa-green-800">Demo data only</div>
        </div>

        {notice && <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-upwa-green-200 bg-upwa-green-50 px-4 py-3 text-sm text-upwa-green-900"><Check size={17} className="mt-0.5 shrink-0" />{notice}<button onClick={() => setNotice("")} className="ml-auto" aria-label="Dismiss message"><X size={16} /></button></div>}

        {groupName === "Overview" && !moduleName ? <>
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-upwa-navy via-[#123c70] to-upwa-blue-700 p-6 text-white shadow-md sm:p-9"><div className="relative z-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">Prototype overview</p><h2 className="mt-3 text-2xl font-bold sm:text-3xl">Explore the UPWA school platform</h2><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Browse an interactive, safe preview of academic management, administration, communications, family services and settings. No login, real records or live integrations.</p><button onClick={() => openGroup("School Management")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-upwa-navy hover:bg-blue-50">Explore modules <ArrowUpRight size={16} /></button></div><div className="absolute -right-10 -top-16 hidden h-72 w-72 rounded-full border-[35px] border-white/5 md:block" /><div className="absolute -bottom-28 right-36 hidden h-64 w-64 rounded-full border-[30px] border-white/5 md:block" /></section>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
            { label: "Demo learners", value: "1,248", change: "Synthetic overview", icon: Users, color: "text-upwa-blue-800 bg-upwa-blue-50" },
            { label: "Attendance today", value: "94.2%", change: "Illustrative only", icon: Activity, color: "text-upwa-green-800 bg-upwa-green-50" },
            { label: "Sample fee collection", value: "₦8.4m", change: "Not financial data", icon: CircleDollarSign, color: "text-upwa-orange-800 bg-upwa-orange-50" },
            { label: "Demo messages", value: "326", change: "No messages sent", icon: MessageSquareText, color: "text-violet-800 bg-violet-50" },
          ].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-bold text-upwa-navy">{card.value}</p></div><span className={`rounded-xl p-2.5 ${card.color}`}><Icon size={19} /></span></div><p className="mt-3 text-[11px] text-slate-500">{card.change}</p></article>; })}</div>
          <section className="mt-6"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-upwa-navy">Feature areas</h2><p className="mt-1 text-sm text-slate-500">Choose a module group to explore the prototype screens.</p></div><label className="relative block w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all features" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-upwa-blue-400" /></label></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(search ? matchingModules.slice(0, 12).map((module) => ({ ...module, summary: module.description, modules: [module] })) : GROUPS).map((group) => { const Icon = GROUP_ICON[group.name] ?? BookOpenCheck; return <button key={group.name} onClick={() => search && group.modules.length === 1 ? openModule(group.modules[0].name, group.group ?? group.name) : openGroup(group.name)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-upwa-blue-200 hover:shadow-md"><span className="inline-flex rounded-xl bg-upwa-blue-50 p-2.5 text-upwa-blue-800"><Icon size={20} /></span><h3 className="mt-4 font-bold text-upwa-navy">{group.name}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{group.summary}</p><div className="mt-4 flex items-center justify-between text-xs"><span className="font-medium text-slate-500">{group.modules.length} feature modules</span><span className="font-semibold text-upwa-blue-800 group-hover:underline">Explore <ArrowUpRight size={13} className="inline" /></span></div></button>; })}</div>
          </section>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-upwa-navy">Demo activity</h2><p className="mt-1 text-xs text-slate-500">Illustrative events generated for this preview</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">SAMPLE</span></div><div className="mt-4 divide-y divide-slate-100">{[["Score review completed", "Demo Primary 2 · 8 minutes ago", "bg-upwa-blue-100 text-upwa-blue-800"], ["Attendance marked", "Demo Secondary · 26 minutes ago", "bg-upwa-green-100 text-upwa-green-800"], ["Application received", "Applicant Demo 014 · 1 hour ago", "bg-upwa-orange-100 text-upwa-orange-800"]].map(([title, detail, style]) => <div key={title} className="flex items-center gap-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${style}`}>DEMO</span><div className="flex-1"><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-0.5 text-xs text-slate-500">{detail}</p></div><ArrowUpRight size={15} className="text-slate-400" /></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-upwa-navy">Quick access</h2><div className="mt-3 space-y-2">{["Attendance", "Academic Reports", "Admission Applications", "Student Fee Statements"].map((module) => { const group = GROUPS.find((item) => item.modules.some((feature) => feature.name === module))?.name ?? "Overview"; return <button key={module} onClick={() => openModule(module, group)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-left text-sm font-medium hover:bg-slate-50"><span>{module}</span><ArrowUpRight size={15} className="text-slate-400" /></button>; })}</div></section></div>
        </> : moduleName && moduleInfo ? <>
          <section className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-upwa-blue-800"><span>{moduleInfo.group}</span><span className="text-slate-300">/</span><span>Prototype module</span></div><h2 className="mt-2 text-xl font-bold text-upwa-navy">{moduleInfo.name}</h2><p className="mt-1 text-sm text-slate-500">{moduleInfo.description}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => simulateAction("Export preview prepared")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ArrowDownToLine size={15} /> Export sample</button><button onClick={() => simulateAction("Action preview opened")} className="inline-flex items-center gap-2 rounded-xl bg-upwa-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-upwa-blue-800"><Plus size={15} /> Try demo action</button></div></section>
          <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Sample records", value: String(rows.length), icon: ClipboardList }, { label: "Demo status", value: "Prototype", icon: Sparkles }, { label: "Data source", value: "Fictional", icon: ShieldCheck }].map((card) => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-upwa-blue-50 p-2 text-upwa-blue-800"><Icon size={17} /></span><div><p className="text-[11px] text-slate-500">{card.label}</p><p className="mt-0.5 text-sm font-bold text-upwa-navy">{card.value}</p></div></div></article>; })}</div>
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h3 className="font-bold text-upwa-navy">{moduleName} · sample workspace</h3><p className="mt-1 text-xs text-slate-500">Fictional rows for demonstrating the layout only.</p></div><span className="rounded-full bg-upwa-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-upwa-orange-900">Not connected to live data</span></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Record</th><th className="px-5 py-3">Details</th><th className="px-5 py-3">Demo status</th><th className="px-5 py-3">View</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={`${moduleName}-${index}`} className="hover:bg-slate-50/60"><td className="px-5 py-3 font-medium text-slate-800">{row[0]}</td><td className="px-5 py-3 text-slate-600">{row[1]}</td><td className="px-5 py-3"><span className="rounded-full bg-upwa-green-50 px-2.5 py-1 text-[10px] font-semibold text-upwa-green-800">{row[2]}</span></td><td className="px-5 py-3"><button onClick={() => simulateAction(`Opened sample ${row[0]}`)} className="text-xs font-semibold text-upwa-blue-800 hover:underline">Open</button></td></tr>)}</tbody></table></div>
            <form onSubmit={addDemoEntry} className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 p-4 sm:flex-row"><input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="Type a sample item to try this form" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-upwa-blue-400" /><button className="rounded-xl bg-upwa-navy px-4 py-2.5 text-sm font-semibold text-white">Add demo item</button></form>
          </section>
          <section className="mt-5 rounded-2xl border border-upwa-blue-100 bg-upwa-blue-50/60 p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2 text-upwa-blue-800"><Bell size={17} /></div><div><h3 className="text-sm font-bold text-upwa-navy">Safe preview behavior</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">This module is a clickable prototype. Any action is simulated in your browser session; there are no database calls, real payments, outgoing messages, account changes or file uploads.</p></div></div></section>
        </> : <>
          <section className="mb-6"><p className="text-sm text-slate-500">Browse each feature area. All preview content is fictional.</p></section>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(selectedGroup?.modules ?? []).map((module) => { const Icon = GROUP_ICON[groupName] ?? BookOpenCheck; return <button key={module.name} onClick={() => openModule(module.name, groupName)} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-upwa-blue-200 hover:shadow-md"><span className="inline-flex rounded-xl bg-upwa-blue-50 p-2.5 text-upwa-blue-800"><Icon size={19} /></span><h3 className="mt-4 font-bold text-upwa-navy">{module.name}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{module.description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-upwa-blue-800">Open demo module <ArrowUpRight size={14} /></span></button>; })}</div>
        </>}
        <footer className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-[11px] text-slate-500 sm:flex-row"><span>UPWA ISMS · public prototype</span><span>Fictional data only · no external services connected</span></footer>
      </div>
    </div>
  </main>;
}
