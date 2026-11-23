"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ExecutiveConsole, FinanceWorkspace, MorningBrief, ResultsCentre, ScoresWorkspace } from "./advanced-workspaces";

type Division = { id: string; code: string; name: string };
type Role = { code: string; label: string; divisionId: string | null };
type PortalMe = {
  user: { id: string; email: string | null; displayName: string | null };
  roles: Role[];
  divisions: Division[];
  permissions: string[];
};
type Summary = {
  enrolment: { activeStudents: number };
  attendance: { present: number; absent: number; late: number; excused: number } | null;
  finance: { billed: number; collected: number; outstanding: number } | null;
  admissions: { submitted: number; underReview: number; offered: number } | null;
};
type Student = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; current_division_id: string; current_class_id: string | null; status: string };
type SchoolClass = { id: string; name: string; sort_order: number };
type Attendance = { id: string; student_id: string; attendance_date: string; status: string; notes: string | null };
type Application = { id: string; application_number: string; applicant_first_name: string; applicant_middle_name: string | null; applicant_last_name: string; guardian_name: string; guardian_email: string | null; guardian_phone: string; status: string; created_at: string; exam_at: string | null };
type ContentEntry = { id: string; content_type: string; division_id: string | null; slug: string; title: string; summary: string | null; status: string; is_placeholder: boolean };
type StaffMember = { id: string; staff_number: string; full_name: string; position_title: string | null; employment_status: string; subjects: string[] };
type View = "overview" | "executive" | "scores" | "results" | "finance" | "students" | "staff" | "attendance" | "admissions" | "website";

const VIEW_PERMISSION: Record<View, string[]> = {
  overview: ["executive.read", "academics.read", "finance.read", "admissions.manage", "parent.read", "student.read", "care.manage", "pickup.manage"],
  executive: ["executive.read"],
  scores: ["academics.read", "results.review"],
  results: ["results.read", "academics.read", "parent.read", "student.read"],
  finance: ["finance.read", "finance.manage"],
  students: ["academics.read", "registry.manage", "admissions.manage", "parent.read", "student.read"],
  staff: ["registry.manage"],
  attendance: ["academics.read", "academics.manage", "parent.read", "student.read"],
  admissions: ["admissions.manage"],
  website: ["cms.manage"],
};

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
const NEXT_APPLICATION_STATUS: Record<string, string> = {
  SUBMITTED: "UNDER_REVIEW",
  UNDER_REVIEW: "EXAM_SCHEDULED",
  EXAM_SCHEDULED: "OFFERED",
  OFFERED: "ACCEPTED",
  WAITLISTED: "OFFERED",
  ACCEPTED: "ENROLLED",
};

export default function PortalWorkspace() {
  const router = useRouter();
  const [me, setMe] = useState<PortalMe | null>(null);
  const [division, setDivision] = useState("ALL");
  const [view, setView] = useState<View>("overview");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [content, setContent] = useState<ContentEntry[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<(typeof STATUSES)[number]>("PRESENT");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isExecutive = me?.roles.some((role) => role.divisionId === null && ["UPWA_PRESIDENT", "EXECUTIVE_BOARD"].includes(role.code)) ?? false;
  const isSelfScoped = me?.roles.some((role) => role.divisionId === null && ["PARENT_GUARDIAN", "STUDENT"].includes(role.code)) ?? false;
  const canAll = isExecutive || isSelfScoped;
  const currentDivision = me?.divisions.find((item) => item.code === division);
  const permissions = me?.permissions ?? [];

  const visibleViews = useMemo(() => (Object.keys(VIEW_PERMISSION) as View[]).filter((key) =>
    VIEW_PERMISSION[key].some((permission) => permissions.includes(permission))
  ), [permissions]);

  const loadMe = useCallback(async () => {
    const response = await fetch("/api/portal/me", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load account access.");
    setMe(result);
    if (!result.roles?.length) return;
    const hasAll = result.roles.some((role: Role) => role.divisionId === null && (["UPWA_PRESIDENT", "EXECUTIVE_BOARD", "PARENT_GUARDIAN", "STUDENT"].includes(role.code)));
    if (!hasAll && result.divisions?.length) setDivision(result.divisions[0].code);
  }, [router]);

  const loadSummary = useCallback(async () => {
    if (!me || !visibleViews.includes("overview")) return;
    const response = await fetch(`/api/portal/summary?division=${encodeURIComponent(division)}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setSummary(result);
    else setError(result.error ?? "Dashboard data is unavailable.");
  }, [division, me, visibleViews]);

  const loadModuleData = useCallback(async () => {
    if (!me || !visibleViews.includes(view) || view === "overview" || view === "executive" || view === "scores" || view === "results" || view === "finance") return;
    setError("");
    const endpoint: Record<Exclude<View, "overview">, string> = {
      executive: "/api/portal/executive",
      scores: "/api/portal/scores",
      results: "/api/portal/results",
      finance: "/api/portal/finance",
      students: "/api/portal/students",
      staff: "/api/portal/staff",
      attendance: "/api/portal/attendance",
      admissions: "/api/portal/admissions",
      website: "/api/portal/content",
    };
    const url = view === "website" ? endpoint[view] : `${endpoint[view]}?division=${encodeURIComponent(division)}`;
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "The selected module is unavailable for this account.");
      return;
    }
    if (view === "students") setStudents(result.students ?? []);
    if (view === "staff") setStaff(result.staff ?? []);
    if (view === "attendance") setAttendance(result.records ?? []);
    if (view === "students" || view === "attendance") {
      const [classResponse, rosterResponse] = await Promise.all([
        fetch(`/api/portal/classes?division=${encodeURIComponent(division)}`, { cache: "no-store" }),
        view === "attendance" ? fetch(`/api/portal/students?division=${encodeURIComponent(division)}`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (classResponse.ok) {
        const classData = await classResponse.json();
        setClasses(classData.classes ?? []);
      }
      if (rosterResponse?.ok) {
        const roster = await rosterResponse.json();
        setStudents(roster.students ?? []);
      }
    }
    if (view === "admissions") setApplications(result.applications ?? []);
    if (view === "website") setContent(result.entries ?? []);
  }, [division, me, view, visibleViews]);

  useEffect(() => {
    loadMe().catch((cause) => setError(cause instanceof Error ? cause.message : "Sign-in required."))
      .finally(() => setLoading(false));
  }, [loadMe]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadModuleData(); }, [loadModuleData]);
  useEffect(() => {
    if (visibleViews.length > 0 && !visibleViews.includes(view)) setView(visibleViews[0]);
  }, [view, visibleViews]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const student = students.find((item) => item.id === selectedStudent);
    if (!student?.current_class_id) {
      setError("This pupil has no active class placement. Ask the school registry to update it.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/portal/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ division, studentId: student.id, classId: student.current_class_id, attendanceDate, status: attendanceStatus }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setError(result.error ?? "Attendance was not saved.");
    else {
      setNotice("Attendance saved in the active division and academic period.");
      await loadModuleData();
    }
  }

  async function changeApplication(application: Application, nextStatus: string) {
    setError("");
    setNotice("");
    setBusy(true);
    const response = await fetch(`/api/portal/admissions/${application.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ division, status: nextStatus, decisionNote: decisionNotes[application.id] ?? "" }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setError(result.error ?? "The application could not be updated.");
    else {
      setNotice(nextStatus === "ENROLLED" ? "Applicant enrolled and added to the student registry." : `Application moved to ${nextStatus.replaceAll("_", " ")}.`);
      await loadModuleData();
      await loadSummary();
    }
  }

  async function signOutAndReset() { await signOut(); }

  if (loading) return <PortalLoading />;
  if (error && !me) return <PortalMessage message={error} />;
  if (!me) return <PortalMessage message="Sign in is required to access the school portal." />;

  return (
    <main className="min-h-screen bg-upwa-canvas">
      <header className="border-t-4 border-t-upwa-orange-500 bg-upwa-navy text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-12 w-11 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight sm:text-base">UPWA International Schools Management System</p>
              <p className="mt-1 text-xs text-slate-300">{me.user.displayName || me.user.email || "Signed-in school account"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="division" className="sr-only">School context</label>
            <select id="division" value={division} onChange={(event) => { setDivision(event.target.value); setSummary(null); }} className="max-w-[13rem] rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white [&>option]:text-slate-900">
              {canAll && <option value="ALL">All UPWA Schools</option>}
              {me.divisions.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
            </select>
            <button onClick={signOutAndReset} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium hover:bg-white/10">Sign out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {me.roles.map((role, index) => <span key={`${role.code}-${role.divisionId}-${index}`} className="rounded-full bg-upwa-blue-100 px-3 py-1 text-xs font-semibold text-upwa-blue-900">{role.label}{role.divisionId ? ` · ${me.divisions.find((item) => item.id === role.divisionId)?.name ?? "School role"}` : ""}</span>)}
          {me.roles.length === 0 && <span className="rounded-full bg-upwa-orange-100 px-3 py-1 text-xs font-semibold text-upwa-orange-900">Role assignment pending</span>}
        </div>
        <nav aria-label="Portal modules" className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {visibleViews.map((item) => <button key={item} onClick={() => { setView(item); setError(""); }} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold capitalize whitespace-nowrap ${view === item ? "border-upwa-blue-700 bg-upwa-blue-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-upwa-blue-50"}`}>{item === "overview" ? "Overview" : item === "executive" ? "Command Console" : item === "scores" ? "Scores & Broadsheet" : item === "results" ? "Results Centre" : item === "finance" ? "Finance" : item === "website" ? "Website CMS" : item}</button>)}
        </nav>

        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-upwa-green-200 bg-upwa-green-50 p-3 text-sm text-upwa-green-900">{notice}</div>}

        {me.roles.length > 0 && visibleViews.length === 0 ? (
          <section className="rounded-2xl border border-upwa-orange-200 bg-white p-6">
            <h1 className="text-lg font-bold text-upwa-navy">No school-data workspace assigned</h1>
            <p className="mt-2 text-sm text-slate-600">This account has platform-level permissions only. Technical administration does not grant pupil, family, academic, financial or medical-record access by default.</p>
          </section>
        ) : me.roles.length === 0 ? (
          <section className="rounded-2xl border border-upwa-orange-200 bg-white p-6">
            <h1 className="text-lg font-bold text-upwa-navy">Your account is awaiting role assignment</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">For your protection, this account cannot view school records yet. Ask an authorised UPWA administrator to link your existing account to your role and school division. Parents and students will only see records explicitly linked to them.</p>
          </section>
        ) : view === "overview" ? (
          <Overview summary={summary} permissions={permissions} division={division} />
        ) : view === "executive" ? (
          <ExecutiveConsole division={division} />
        ) : view === "scores" ? (
          <ScoresWorkspace division={division} permissions={permissions} />
        ) : view === "results" ? (
          <ResultsCentre division={division} canIssue={permissions.includes("results.publish")} />
        ) : view === "finance" ? (
          <FinanceWorkspace division={division} permissions={permissions} />
        ) : view === "students" ? (
          <StudentList students={students} classes={classes} division={division} canCreate={permissions.includes("registry.manage") && division !== "ALL"} onCreated={loadModuleData} />
        ) : view === "staff" ? (
          <StaffList staff={staff} division={division} onCreated={loadModuleData} />
        ) : view === "attendance" ? (
          <AttendancePanel
            records={attendance}
            students={students}
            canRecord={permissions.includes("academics.manage") && division !== "ALL"}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            attendanceDate={attendanceDate}
            setAttendanceDate={setAttendanceDate}
            attendanceStatus={attendanceStatus}
            setAttendanceStatus={setAttendanceStatus}
            onSubmit={submitAttendance}
            busy={busy}
          />
        ) : view === "admissions" ? (
          <AdmissionsPanel applications={applications} division={division} decisionNotes={decisionNotes} setDecisionNotes={setDecisionNotes} onChange={changeApplication} busy={busy} />
        ) : (
          <ContentPanel entries={content} divisionId={currentDivision?.id ?? null} onSaved={loadModuleData} />
        )}
      </div>
    </main>
  );
}

function Overview({ summary, permissions, division }: { summary: Summary | null; permissions: string[]; division: string }) {
  if (!summary) return <Panel title="School overview" body="Loading authorised dashboard data…" />;
  const tiles = [
    { label: "Active pupils", value: permissions.some((p) => ["executive.read", "academics.read", "parent.read", "student.read"].includes(p)) ? summary.enrolment.activeStudents.toLocaleString() : "Restricted", note: "Visible rows only; counts follow your role and linked records." },
    ...(summary.attendance ? [{ label: "Present today", value: summary.attendance.present.toLocaleString(), note: `${summary.attendance.absent} absent · ${summary.attendance.late} late · ${summary.attendance.excused} excused` }] : []),
    ...(summary.finance ? [{ label: "Fees billed", value: formatNaira(summary.finance.billed), note: `${formatNaira(summary.finance.collected)} collected · ${formatNaira(summary.finance.outstanding)} outstanding` }] : []),
    ...(summary.admissions ? [{ label: "Admissions", value: summary.admissions.submitted.toLocaleString(), note: `${summary.admissions.underReview} in review · ${summary.admissions.offered} offers / waitlist` }] : []),
  ];
  return <>
    <div className="mb-5"><h1 className="text-xl font-bold text-upwa-navy">{division === "ALL" ? "All UPWA Schools" : "Division dashboard"}</h1><p className="mt-1 text-sm text-slate-600">Live, role-scoped summary from the school database. No sample or placeholder records are included.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles.map((tile) => <section key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p><p className="mt-3 text-2xl font-bold text-upwa-navy">{tile.value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{tile.note}</p></section>)}</div>
    {permissions.includes("executive.read") && <MorningBrief division={division} />}
  </>;
}

function StudentList({ students, classes, division, canCreate, onCreated }: { students: Student[]; classes: SchoolClass[]; division: string; canCreate: boolean; onCreated: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/portal/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        division,
        admissionNumber: String(form.get("admissionNumber") ?? ""),
        firstName: String(form.get("firstName") ?? ""),
        middleName: String(form.get("middleName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        dateOfBirth: String(form.get("dateOfBirth") ?? "") || undefined,
        gender: String(form.get("gender") ?? "") || undefined,
        classId: String(form.get("classId") ?? "") || null,
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Student record was not created."); return; }
    formElement.reset();
    await onCreated();
  }
  const className = new Map(classes.map((item) => [item.id, item.name]));
  return <div className="space-y-5">
    {canCreate && <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="font-bold text-upwa-navy">Add a student record</h1><p className="mt-1 text-xs text-slate-600">Creates a new permanent identity and placement. Existing rows are never overwritten; admission numbers must be unique. A current school session must be configured.</p>
      <form onSubmit={createStudent} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">Admission number<input name="admissionNumber" required maxLength={40} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">First name<input name="firstName" required maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Middle name<input name="middleName" maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Last name<input name="lastName" required maxLength={80} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Date of birth<input name="dateOfBirth" type="date" max={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Class<select name="classId" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Not placed yet</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Gender<select name="gender" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Not recorded</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="UNSPECIFIED">Unspecified</option></select></label>
        <button disabled={saving} className="self-end rounded-lg bg-upwa-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create pupil record"}</button>
      </form>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>}
    {canCreate && <ImportPanel division={division} onComplete={onCreated} />}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-bold text-upwa-navy">Student registry</h2><p className="mt-1 text-sm text-slate-600">Only records permitted by your account&apos;s role, school and guardian links appear here.</p></div>{students.length === 0 ? <p className="p-6 text-sm text-slate-500">No authorised pupil records are available in this context.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Admission no.</th><th className="px-5 py-3">Pupil</th><th className="px-5 py-3">Class</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id}><td className="px-5 py-3 font-mono text-xs">{student.admission_number}</td><td className="px-5 py-3">{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</td><td className="px-5 py-3">{student.current_class_id ? className.get(student.current_class_id) ?? "Assigned class" : "Unplaced"}</td><td className="px-5 py-3">{student.status}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}

function StaffList({ staff, division, onCreated }: { staff: StaffMember[]; division: string; onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (division === "ALL") { setError("Select one school division before adding staff."); return; }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError("");
    const response = await fetch("/api/portal/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ division, staffNumber: form.get("staffNumber"), fullName: form.get("fullName"), positionTitle: form.get("positionTitle"), employmentStatus: form.get("employmentStatus"), subjects: String(form.get("subjects") ?? "").split(",").map((item) => item.trim()).filter(Boolean) }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Staff profile was not saved."); return; }
    formElement.reset();
    await onCreated();
  }
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="font-bold text-upwa-navy">Staff registry</h1><p className="mt-1 text-sm text-slate-600">Employment profiles and subject allocations are division-scoped. Sign-in accounts and roles are assigned separately; adding a profile never grants portal access.</p>
      {division !== "ALL" && <form onSubmit={addStaff} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-semibold text-slate-600">Staff number<input name="staffNumber" required maxLength={40} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Full name<input name="fullName" required maxLength={160} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Position<input name="positionTitle" maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Subjects, comma separated<input name="subjects" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Employment status<select name="employmentStatus" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>ACTIVE</option><option>ON_LEAVE</option><option>ENDED</option></select></label><button disabled={busy} className="self-end rounded-lg bg-upwa-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Add staff profile"}</button></form>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="border-b border-slate-200 p-5 font-bold text-upwa-navy">Current division staff</h2>{staff.length === 0 ? <p className="p-5 text-sm text-slate-500">No staff profiles are available in this division.</p> : <div className="divide-y divide-slate-100">{staff.map((person) => <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{person.full_name}</p><p className="text-xs text-slate-500">{person.staff_number} · {person.position_title || "Position not entered"}</p></div><div className="text-right"><span className="rounded-full bg-upwa-blue-50 px-3 py-1 text-xs font-semibold text-upwa-blue-800">{person.employment_status}</span><p className="mt-1 text-xs text-slate-500">{person.subjects?.join(", ") || "No subjects recorded"}</p></div></div>)}</div>}</section>
  </div>;
}

function ImportPanel({ division, onComplete }: { division: string; onComplete: () => Promise<void> }) {
  const [entityType, setEntityType] = useState<"STUDENTS" | "STAFF">("STUDENTS");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ jobId: string; totalRows: number; validRows: number; duplicateRows: number; errorRows: number; canCommit: boolean; rows: { line: number; values: Record<string, string>; errors: string[] }[] } | null>(null);
  const [jobs, setJobs] = useState<{ id: string; entity_type: string; source_filename: string; total_rows: number; inserted_rows: number; error_rows: number; status: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadJobs = useCallback(async () => {
    const response = await fetch(`/api/portal/import?division=${encodeURIComponent(division)}`, { cache: "no-store" });
    if (response.ok) { const result = await response.json(); setJobs(result.jobs ?? []); }
  }, [division]);
  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function runImport(action: "preview" | "commit") {
    if (!file) { setError("Choose a CSV file first."); return; }
    setBusy(true); setError(""); setNotice("");
    const form = new FormData();
    form.set("division", division);
    form.set("entityType", entityType);
    form.set("action", action);
    form.set("file", file);
    if (action === "commit" && preview) form.set("jobId", preview.jobId);
    const response = await fetch("/api/portal/import", { method: "POST", body: form });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "The import could not be completed."); return; }
    if (action === "preview") {
      setPreview(result);
      setNotice(result.canCommit ? "Preview is clean. Review the rows, then confirm the insert." : "Resolve every duplicate or validation error in your file, then upload a corrected file and preview again.");
      await loadJobs();
    } else {
      setPreview(null); setFile(null);
      setNotice(`${result.importedRows} records were inserted. No existing student or staff records were overwritten.`);
      await loadJobs(); await onComplete();
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold text-upwa-navy">Spreadsheet / CSV import</h2>
    <p className="mt-1 text-xs leading-5 text-slate-600">Import pupil or staff profiles with a validation preview. Import only inserts new identities; duplicates must be reconciled and no historical record is silently changed.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold text-slate-600">Record type<select value={entityType} onChange={(event) => { setEntityType(event.target.value as "STUDENTS" | "STAFF"); setPreview(null); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="STUDENTS">Students</option><option value="STAFF">Staff</option></select></label>
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">CSV file<input type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); }} className="mt-1 block w-full text-sm" /></label>
    </div>
    <p className="mt-2 text-[11px] text-slate-500">Student columns: admission_number, first_name, last_name, class_name; optional middle_name, date_of_birth (YYYY-MM-DD), gender. Staff columns: staff_number, full_name; optional position_title, employment_status, subjects (semicolon-separated).</p>
    <button disabled={busy || !file} onClick={() => runImport("preview")} className="mt-3 rounded-lg bg-upwa-blue-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Checking…" : "Validate and preview"}</button>
    {preview && <div className="mt-4 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3 text-xs font-semibold"><span>{preview.totalRows} rows</span><span className="text-upwa-green-800">{preview.validRows} valid</span><span className="text-upwa-orange-800">{preview.duplicateRows} possible duplicates</span><span className="text-rose-700">{preview.errorRows} rows with issues</span></div>
      <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-100">{preview.rows.map((row) => <div key={row.line} className="border-b border-slate-100 p-3 text-xs"><p className="font-semibold">CSV row {row.line} · {row.values.admission_number ?? row.values.staff_number ?? "Record"} · {row.values.first_name ?? row.values.full_name ?? ""}</p>{row.errors.length > 0 ? <ul className="mt-1 list-disc pl-4 text-rose-700">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul> : <p className="mt-1 text-upwa-green-800">Ready to insert</p>}</div>)}</div>
      <button disabled={busy || !preview.canCommit} onClick={() => runImport("commit")} className="mt-3 rounded-lg bg-upwa-green-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Importing…" : "Confirm insert"}</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-slate-700">{notice}</p>}
    <div className="mt-5 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Import reconciliation log</h3>{jobs.length === 0 ? <p className="mt-2 text-xs text-slate-500">No imports have been previewed.</p> : <ul className="mt-2 space-y-2">{jobs.map((job) => <li key={job.id} className="flex flex-wrap justify-between gap-2 text-xs"><span>{job.entity_type} · {job.source_filename} · {job.total_rows} rows</span><span className="font-semibold">{job.status}{job.status === "COMPLETED" ? ` · ${job.inserted_rows} inserted` : job.error_rows ? ` · ${job.error_rows} issue rows` : ""}</span></li>)}</ul>}</div>
  </section>;
}

function AttendancePanel({ records, students, canRecord, selectedStudent, setSelectedStudent, attendanceDate, setAttendanceDate, attendanceStatus, setAttendanceStatus, onSubmit, busy }: {
  records: Attendance[]; students: Student[]; canRecord: boolean; selectedStudent: string; setSelectedStudent: (value: string) => void;
  attendanceDate: string; setAttendanceDate: (value: string) => void; attendanceStatus: (typeof STATUSES)[number];
  setAttendanceStatus: (value: (typeof STATUSES)[number]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean;
}) {
  const nameById = new Map(students.map((student) => [student.id, `${student.first_name} ${student.last_name}`]));
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="font-bold text-upwa-navy">Attendance</h1><p className="mt-1 text-sm text-slate-600">Attendance states are Present, Absent, Late and Excused. Staff can record only assigned classes; linked families see their own children&apos;s entries.</p>
      {canRecord && <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">Pupil<select value={selectedStudent} required onChange={(event) => setSelectedStudent(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Select pupil</option>{students.filter((student) => student.current_class_id).map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name} · {student.admission_number}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Date<input type="date" required value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Status<select value={attendanceStatus} onChange={(event) => setAttendanceStatus(event.target.value as (typeof STATUSES)[number])} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <button disabled={busy} className="self-end rounded-lg bg-upwa-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save attendance"}</button>
      </form>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><h2 className="border-b border-slate-200 p-5 font-bold text-upwa-navy">Recent attendance</h2>{records.length === 0 ? <p className="p-5 text-sm text-slate-500">No attendance has been recorded for the records you can access.</p> : <div className="divide-y divide-slate-100">{records.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"><span>{nameById.get(record.student_id) ?? "Linked pupil"}</span><span className="text-slate-500">{record.attendance_date}</span><span className="rounded-full bg-upwa-blue-50 px-3 py-1 text-xs font-semibold text-upwa-blue-800">{record.status}</span></div>)}</div>}</section>
  </div>;
}

function AdmissionsPanel({ applications, division, decisionNotes, setDecisionNotes, onChange, busy }: {
  applications: Application[]; division: string; decisionNotes: Record<string, string>; setDecisionNotes: (value: Record<string, string>) => void;
  onChange: (application: Application, nextStatus: string) => void; busy: boolean;
}) {
  const [documents, setDocuments] = useState<Record<string, { id: string; type: string; uploadedAt: string; url: string }[]>>({});
  const [loadingDocuments, setLoadingDocuments] = useState<Record<string, boolean>>({});
  const [documentError, setDocumentError] = useState("");

  async function viewDocuments(applicationId: string) {
    setDocumentError("");
    setLoadingDocuments({ ...loadingDocuments, [applicationId]: true });
    const response = await fetch(`/api/portal/admissions/${applicationId}/documents?division=${encodeURIComponent(division)}`, { cache: "no-store" });
    const result = await response.json();
    setLoadingDocuments({ ...loadingDocuments, [applicationId]: false });
    if (!response.ok) { setDocumentError(result.error ?? "Could not load private documents."); return; }
    setDocuments({ ...documents, [applicationId]: result.documents ?? [] });
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="font-bold text-upwa-navy">Admissions review</h1><p className="mt-1 text-sm text-slate-600">Status changes are validated on the server and written to the admissions history. Private supporting documents are only available to authorised admissions staff.</p>{applications.length === 0 ? <p className="mt-5 text-sm text-slate-500">No applications are available in this authorised division.</p> : <div className="mt-4 space-y-3">{applications.map((application) => { const next = NEXT_APPLICATION_STATUS[application.status]; return <article key={application.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{application.applicant_first_name} {application.applicant_middle_name} {application.applicant_last_name}</p><p className="mt-1 text-xs text-slate-500">{application.application_number} · Guardian {application.guardian_name} · {application.guardian_phone}</p></div><span className="h-fit rounded-full bg-upwa-blue-50 px-3 py-1 text-xs font-semibold text-upwa-blue-800">{application.status.replaceAll("_", " ")}</span></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={loadingDocuments[application.id]} onClick={() => viewDocuments(application.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">{loadingDocuments[application.id] ? "Loading…" : "View private documents"}</button>{next && <><input value={decisionNotes[application.id] ?? ""} onChange={(event) => setDecisionNotes({ ...decisionNotes, [application.id]: event.target.value })} placeholder="Decision / review note (optional)" className="min-w-52 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button disabled={busy} onClick={() => onChange(application, next)} className="rounded-lg bg-upwa-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{next === "ENROLLED" ? "Enrol accepted applicant" : `Move to ${next.replaceAll("_", " ")}`}</button>{["SUBMITTED", "UNDER_REVIEW", "EXAM_SCHEDULED"].includes(application.status) && <button disabled={busy} onClick={() => onChange(application, "REJECTED")} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Reject</button>}</>}</div>{documents[application.id] && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs"><p className="font-semibold">Private links expire after one minute</p>{documents[application.id].length === 0 ? <p className="mt-1 text-slate-500">No documents uploaded.</p> : documents[application.id].map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="mt-1 block font-medium text-upwa-blue-800 underline">{document.type.replaceAll("_", " ")} · {new Date(document.uploadedAt).toLocaleDateString()}</a>)}</div>}</article>; })}</div>}{documentError && <p role="alert" className="mt-3 text-sm text-rose-700">{documentError}</p>}</section>;
}

function ContentPanel({ entries, divisionId, onSaved }: { entries: ContentEntry[]; divisionId: string | null; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/portal/content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: form.get("contentType"),
        divisionId,
        slug: form.get("slug"),
        title: form.get("title"),
        summary: form.get("summary"),
        body: { text: form.get("body") },
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setError(result.error ?? "Content could not be saved."); return; }
    formElement.reset();
    setMessage("Draft saved. Review it carefully before publishing.");
    await onSaved();
  }

  async function publish(entry: ContentEntry) {
    setSaving(true);
    setError("");
    const response = await fetch("/api/portal/content", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: entry.id, status: "PUBLISHED", isPlaceholder: false }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) setError(result.error ?? "Content could not be published.");
    else { setMessage("Content published to the public school website."); await onSaved(); }
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h1 className="font-bold text-upwa-navy">Website CMS</h1><p className="mt-1 text-sm text-slate-600">Create and publish approved pages, news, events, calendars and division content. Publishing is restricted to your assigned scope.</p>
      <form onSubmit={createEntry} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Content type<select name="contentType" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{["PAGE","NEWS","EVENT","CALENDAR","ACADEMIC_OFFERING","FACILITY","ACHIEVEMENT","LEADERSHIP_NOTE","ALUMNAE","SCHOLARSHIP","DEVELOPMENT_PROJECT","DONATION_CAMPAIGN","GALLERY","CAMPUS_TOUR"].map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">URL slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="school-calendar" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Title<input name="title" required maxLength={180} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Summary<textarea name="summary" maxLength={500} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Approved content<textarea name="body" rows={5} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <button disabled={saving} className="w-fit rounded-lg bg-upwa-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save draft"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-upwa-green-800">{message}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold text-upwa-navy">Content entries</h2>{entries.length === 0 ? <p className="mt-4 text-sm text-slate-500">No entries are available to this editor yet.</p> : <div className="mt-3 divide-y divide-slate-100">{entries.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{entry.title}</p><p className="text-xs text-slate-500">{entry.content_type} · /{entry.slug}{entry.is_placeholder ? " · Placeholder" : ""}</p></div><div className="flex items-center gap-2"><span className="text-xs font-semibold text-upwa-blue-800">{entry.status}</span>{entry.status !== "PUBLISHED" && <button disabled={saving} onClick={() => publish(entry)} className="rounded-lg border border-upwa-blue-200 px-3 py-1.5 text-xs font-semibold text-upwa-blue-800 disabled:opacity-50">Publish</button>}</div></div>)}</div>}<p className="mt-4 rounded-xl bg-upwa-orange-50 p-3 text-xs leading-5 text-upwa-orange-900">Only verified UPWA facts, names, photographs and achievements should be published. Do not upload photographs until the private school storage bucket is configured.</p></section>
  </div>;
}

function Panel({ title, body }: { title: string; body: string }) { return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h1 className="font-bold text-upwa-navy">{title}</h1><p className="mt-2 text-sm text-slate-600">{body}</p></section>; }
function PortalLoading() { return <main className="min-h-screen bg-upwa-canvas p-8"><div className="mx-auto max-w-4xl animate-pulse rounded-2xl bg-white p-8 text-sm text-slate-500">Loading your secure school workspace…</div></main>; }
function PortalMessage({ message }: { message: string }) { return <main className="min-h-screen bg-upwa-canvas p-8"><div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700">{message}</div></main>; }
function formatNaira(value: number) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value); }
