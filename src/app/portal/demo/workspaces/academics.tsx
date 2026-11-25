"use client";

import { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Printer,
  Save,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useDemo } from "../store";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  StatCard,
  StatusBadge,
  inputClass,
  type Column,
} from "../ui";
import { Select } from "../ui";
import {
  CLASS_ARMS,
  CLASS_ORDER,
  type AttendanceRecord,
  type AttendanceStatus,
  type SchoolClass,
  type Score,
  type Student,
} from "../types";
import { subjectsForClass } from "../seed";
import {
  attendanceSummary,
  classPositions,
  formatDate,
  fullName,
  gradeFor,
  ordinal,
  scoreTotal,
  termLabel,
  weekdayOf,
} from "../format";

const STATUSES: { value: AttendanceStatus; label: string; short: string; active: string; idle: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", active: "bg-upwa-green-600 text-white border-upwa-green-600", idle: "border-slate-300 text-slate-600 hover:border-upwa-green-400 hover:bg-upwa-green-50" },
  { value: "LATE", label: "Late", short: "L", active: "bg-upwa-orange-500 text-white border-upwa-orange-500", idle: "border-slate-300 text-slate-600 hover:border-upwa-orange-400 hover:bg-upwa-orange-50" },
  { value: "ABSENT", label: "Absent", short: "A", active: "bg-rose-600 text-white border-rose-600", idle: "border-slate-300 text-slate-600 hover:border-rose-400 hover:bg-rose-50" },
  { value: "EXCUSED", label: "Excused", short: "E", active: "bg-violet-600 text-white border-violet-600", idle: "border-slate-300 text-slate-600 hover:border-violet-400 hover:bg-violet-50" },
];

function classesWithData(students: Student[]) {
  return CLASS_ORDER.filter((className) => students.some((student) => student.className === className));
}

/* =============================== attendance ============================== */

export function AttendanceWorkspace() {
  const { data, replaceAll, notify } = useDemo();
  const [className, setClassName] = useState<SchoolClass | "">("");
  const [arm, setArm] = useState<string>("A");
  const [date, setDate] = useState("");
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [dirty, setDirty] = useState(false);

  const students = data?.students ?? [];
  const attendance = data?.attendance ?? [];
  const availableClasses = useMemo(() => classesWithData(students), [students]);
  const activeClass = className || (availableClasses[4] ?? availableClasses[0] ?? "Primary 1");
  const dates = useMemo(
    () => Array.from(new Set(attendance.map((record) => record.date))).sort((a, b) => b.localeCompare(a)),
    [attendance],
  );
  const activeDate = date || dates[0] || new Date().toISOString().slice(0, 10);

  const roster = useMemo(
    () =>
      students
        .filter((student) => student.className === activeClass && student.arm === arm && student.status === "ACTIVE")
        .sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [students, activeClass, arm],
  );

  const existing = useMemo(
    () => attendance.filter((record) => record.date === activeDate && record.className === activeClass && record.arm === arm),
    [attendance, activeDate, activeClass, arm],
  );

  // Seed the register from saved entries whenever the class, arm or date changes.
  const signature = `${activeClass}|${arm}|${activeDate}|${existing.length}`;
  const [loadedFor, setLoadedFor] = useState("");
  if (signature !== loadedFor) {
    setLoadedFor(signature);
    const seeded: Record<string, AttendanceStatus> = {};
    roster.forEach((student) => {
      const found = existing.find((record) => record.studentId === student.id);
      seeded[student.id] = found?.status ?? "PRESENT";
    });
    setDraft(seeded);
    setDirty(false);
  }

  if (!data) return null;
  const { settings } = data;

  const summary = STATUSES.map((status) => ({
    ...status,
    count: roster.filter((student) => draft[student.id] === status.value).length,
  }));
  const marked = summary.find((item) => item.value === "PRESENT")?.count ?? 0;
  const rate = roster.length ? Math.round(((marked + (summary.find((i) => i.value === "LATE")?.count ?? 0)) / roster.length) * 1000) / 10 : 0;

  function markAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    roster.forEach((student) => {
      next[student.id] = status;
    });
    setDraft(next);
    setDirty(true);
  }

  function saveRegister() {
    const withoutToday = attendance.filter(
      (record) => !(record.date === activeDate && record.className === activeClass && record.arm === arm),
    );
    const fresh: AttendanceRecord[] = roster.map((student) => ({
      id: `att-${student.id}-${activeDate}`,
      studentId: student.id,
      className: activeClass as SchoolClass,
      arm: arm as Student["arm"],
      date: activeDate,
      status: draft[student.id] ?? "PRESENT",
      note: draft[student.id] === "EXCUSED" ? "Excused — note received from parent" : "",
      recordedBy: "Mrs. Uchenna Aluu (Class Teacher)",
    }));
    replaceAll("attendance", [...fresh, ...withoutToday]);
    setDirty(false);
    notify("Register saved", "success", `${activeClass} ${arm} · ${formatDate(activeDate)} · ${rate}% present`);
  }

  const byDate = dates.slice(0, 10).map((entry) => {
    const records = attendance.filter((record) => record.date === entry);
    return { date: entry, ...attendanceSummary(records), classes: new Set(records.map((r) => `${r.className}${r.arm}`)).size };
  });

  const columns: Column<(typeof byDate)[number]>[] = [
    {
      key: "date",
      header: "School day",
      sortValue: (row) => row.date,
      searchValue: (row) => `${row.date} ${weekdayOf(row.date)}`,
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{formatDate(row.date)}</p>
          <p className="text-[11px] text-slate-500">{weekdayOf(row.date)}</p>
        </div>
      ),
    },
    { key: "classes", header: "Classes marked", align: "center", render: (row) => <Badge tone="blue">{row.classes} registers</Badge> },
    { key: "present", header: "Present", align: "center", sortValue: (row) => row.present, render: (row) => <span className="font-semibold text-upwa-green-700">{row.present}</span> },
    { key: "late", header: "Late", align: "center", sortValue: (row) => row.late, render: (row) => <span className="font-semibold text-upwa-orange-700">{row.late}</span> },
    { key: "absent", header: "Absent", align: "center", sortValue: (row) => row.absent, render: (row) => <span className="font-semibold text-rose-600">{row.absent}</span> },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      sortValue: (row) => row.rate,
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 sm:block">
            <div className="h-full rounded-full bg-upwa-green-600" style={{ width: `${row.rate}%` }} />
          </div>
          <span className="font-semibold text-slate-800">{row.rate}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's attendance" value={`${rate}%`} note={`${activeClass} ${arm} · ${roster.length} pupils on roll`} icon={<UserCheck size={19} />} tone="green" />
        <StatCard label="Registers recorded" value={String(dates.length)} note={`${attendance.length} pupil entries this term`} icon={<CalendarCheck size={19} />} />
        <StatCard label="School target" value={`${settings.attendanceTarget}%`} note="Set by the Head Teacher each session" icon={<TrendingUp size={19} />} tone="orange" />
        <StatCard label="Absent this term" value={String(attendance.filter((record) => record.status === "ABSENT").length)} note="Triggers an automatic SMS to the parent" icon={<ClipboardCheck size={19} />} tone="violet" />
      </div>

      <Card>
        <CardHeader
          title="Daily register"
          subtitle="Tap a status for each pupil, then save. Saving overwrites any earlier register for the same class and date."
          icon={<CalendarCheck size={18} />}
          action={dirty ? <Badge tone="orange">Unsaved changes</Badge> : <Badge tone="green">Up to date</Badge>}
        />

        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Class</span>
            <Select value={activeClass} onChange={(event) => setClassName(event.target.value as SchoolClass)}>
              {availableClasses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Arm</span>
            <Select value={arm} onChange={(event) => setArm(event.target.value)}>
              {CLASS_ARMS.map((item) => (
                <option key={item} value={item}>Arm {item}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Date</span>
            <input type="date" value={activeDate} onChange={(event) => setDate(event.target.value)} className={inputClass} />
          </label>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => markAll("PRESENT")} className="flex-1">All present</Button>
            <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={saveRegister} className="flex-1">Save</Button>
          </div>
        </div>

        {roster.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No active pupils in {activeClass} Arm {arm}. Choose another class or arm.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {summary.map((item) => (
                <span key={item.value} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${item.active}`}>{item.short}</span>
                  <span className="font-semibold text-slate-700">{item.label}</span>
                  <span className="font-display text-base font-bold text-upwa-navy">{item.count}</span>
                </span>
              ))}
            </div>

            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {roster.map((student) => (
                <li key={student.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-upwa-canvas/50">
                  <Avatar name={`${student.firstName} ${student.lastName}`} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{student.lastName}, {student.firstName}</p>
                    <p className="truncate font-mono text-[10px] text-slate-400">{student.admissionNumber}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {STATUSES.map((status) => (
                      <button
                        key={status.value}
                        type="button"
                        aria-label={`Mark ${fullName(student)} ${status.label}`}
                        aria-pressed={draft[student.id] === status.value}
                        onClick={() => {
                          setDraft((current) => ({ ...current, [student.id]: status.value }));
                          setDirty(true);
                        }}
                        className={`h-9 w-9 rounded-lg border text-xs font-bold transition-all duration-200 ${
                          draft[student.id] === status.value ? status.active : status.idle
                        }`}
                      >
                        {status.short}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <DataTable
        rows={byDate}
        columns={columns}
        getId={(row) => row.date}
        title="Register history"
        subtitle="Attendance captured across all classes this term."
        searchPlaceholder="Search by date…"
        pageSize={6}
      />
    </div>
  );
}

/* ================================ gradebook ============================== */

export function GradebookWorkspace() {
  const { data, replaceAll, notify } = useDemo();
  const [className, setClassName] = useState<SchoolClass | "">("");
  const [arm, setArm] = useState("A");
  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({});
  const [dirty, setDirty] = useState(false);
  const [loadedFor, setLoadedFor] = useState("");

  if (!data) return null;
  const { students, subjects, scores, settings } = data;

  const availableClasses = classesWithData(students);
  const activeClass = className || (availableClasses.find((item) => item.startsWith("Primary")) ?? availableClasses[0] ?? "Primary 1");
  const classSubjects = subjectsForClass(subjects, activeClass as SchoolClass);
  const activeSubjectId = subjectId || classSubjects[0]?.id || "";
  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId);

  const roster = students
    .filter((student) => student.className === activeClass && student.arm === arm && student.status === "ACTIVE")
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const signature = `${activeClass}|${arm}|${activeSubjectId}`;
  if (loadedFor !== signature) {
    setLoadedFor(signature);
    const seeded: Record<string, { ca1: string; ca2: string; exam: string }> = {};
    roster.forEach((student) => {
      const found = scores.find(
        (score) => score.studentId === student.id && score.subjectId === activeSubjectId && score.term === settings.currentTerm,
      );
      seeded[student.id] = {
        ca1: String(found?.ca1 ?? 0),
        ca2: String(found?.ca2 ?? 0),
        exam: String(found?.exam ?? 0),
      };
    });
    setDraft(seeded);
    setDirty(false);
  }

  function totalFor(studentId: string) {
    const entry = draft[studentId] ?? { ca1: "0", ca2: "0", exam: "0" };
    return (Number(entry.ca1) || 0) + (Number(entry.ca2) || 0) + (Number(entry.exam) || 0);
  }

  const totals = roster.map((student) => totalFor(student.id));
  const average = totals.length ? Math.round((totals.reduce((sum, value) => sum + value, 0) / totals.length) * 10) / 10 : 0;
  const highest = totals.length ? Math.max(...totals) : 0;
  const lowest = totals.length ? Math.min(...totals) : 0;
  const passRate = totals.length ? Math.round((totals.filter((total) => total >= 40).length / totals.length) * 100) : 0;

  function clampField(studentId: string, field: "ca1" | "ca2" | "exam", raw: string) {
    const max = field === "exam" ? settings.examMax : settings.caMax;
    const cleaned = raw.replace(/[^\d]/g, "").slice(0, 3);
    const value = cleaned === "" ? "" : String(Math.min(Number(cleaned), max));
    setDraft((current) => ({ ...current, [studentId]: { ...current[studentId], [field]: value } }));
    setDirty(true);
  }

  function saveSheet() {
    const withoutSubject = scores.filter(
      (score) =>
        !(
          score.subjectId === activeSubjectId &&
          score.className === activeClass &&
          score.arm === arm &&
          score.term === settings.currentTerm &&
          score.session === settings.session
        ),
    );
    const fresh: Score[] = roster.map((student) => {
      const entry = draft[student.id] ?? { ca1: "0", ca2: "0", exam: "0" };
      return {
        id: `sco-${student.id}-${activeSubjectId}`,
        studentId: student.id,
        subjectId: activeSubjectId,
        className: activeClass as SchoolClass,
        arm: arm as Student["arm"],
        session: settings.session,
        term: settings.currentTerm,
        ca1: Number(entry.ca1) || 0,
        ca2: Number(entry.ca2) || 0,
        exam: Number(entry.exam) || 0,
      };
    });
    replaceAll("scores", [...withoutSubject, ...fresh]);
    setDirty(false);
    notify("Broadsheet saved", "success", `${activeSubject?.name} · ${activeClass} ${arm} · class average ${average}`);
  }

  const sheetRows = classSubjects.map((subject) => {
    const subjectScores = scores.filter(
      (score) => score.subjectId === subject.id && score.className === activeClass && score.arm === arm && score.term === settings.currentTerm,
    );
    const subjectTotals = subjectScores.map(scoreTotal);
    const subjectAverage = subjectTotals.length ? Math.round((subjectTotals.reduce((a, b) => a + b, 0) / subjectTotals.length) * 10) / 10 : 0;
    return { subject, entries: subjectScores.length, average: subjectAverage, best: subjectTotals.length ? Math.max(...subjectTotals) : 0 };
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Continuous assessment & examination sheet"
          subtitle={`CA1 and CA2 are marked out of ${settings.caMax} each; the examination is out of ${settings.examMax}. Totals and grades are calculated as you type.`}
          icon={<ClipboardCheck size={18} />}
          action={dirty ? <Badge tone="orange">Unsaved marks</Badge> : <Badge tone="green">Saved</Badge>}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Class</span>
            <Select value={activeClass} onChange={(event) => { setClassName(event.target.value as SchoolClass); setSubjectId(""); }}>
              {availableClasses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Arm</span>
            <Select value={arm} onChange={(event) => setArm(event.target.value)}>
              {CLASS_ARMS.map((item) => (
                <option key={item} value={item}>Arm {item}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Subject</span>
            <Select value={activeSubjectId} onChange={(event) => setSubjectId(event.target.value)}>
              {classSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Term</span>
            <Select value={settings.currentTerm} disabled>
              <option value="FIRST">{termLabel("FIRST")} · {settings.session}</option>
              <option value="SECOND">{termLabel("SECOND")} · {settings.session}</option>
              <option value="THIRD">{termLabel("THIRD")} · {settings.session}</option>
            </Select>
          </label>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Class average" value={String(average)} note={`${activeSubject?.name ?? "Subject"} · ${roster.length} pupils`} icon={<BarChart3 size={19} />} />
        <StatCard label="Highest score" value={String(highest)} note={`Grade ${gradeFor(highest, settings.grading).grade}`} icon={<Award size={19} />} tone="green" />
        <StatCard label="Lowest score" value={String(lowest)} note={`Grade ${gradeFor(lowest, settings.grading).grade}`} icon={<TrendingUp size={19} />} tone="orange" />
        <StatCard label="Pass rate" value={`${passRate}%`} note="Pupils scoring 40 and above" icon={<UserCheck size={19} />} tone="violet" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-upwa-navy">{activeSubject?.name} — {activeClass} {arm}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Taught by {data.staff.find((member) => member.id === activeSubject?.teacherId)?.firstName ?? "—"}{" "}
              {data.staff.find((member) => member.id === activeSubject?.teacherId)?.lastName ?? ""}
            </p>
          </div>
          <Button variant="primary" size="sm" icon={<Save size={15} />} onClick={saveSheet} disabled={roster.length === 0}>
            Save broadsheet
          </Button>
        </div>

        {roster.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No active pupils in {activeClass} Arm {arm}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Pupil</th>
                  <th className="px-3 py-3 text-center">CA1 /{settings.caMax}</th>
                  <th className="px-3 py-3 text-center">CA2 /{settings.caMax}</th>
                  <th className="px-3 py-3 text-center">Exam /{settings.examMax}</th>
                  <th className="px-3 py-3 text-center">Total /100</th>
                  <th className="px-5 py-3 text-center">Grade</th>
                  <th className="px-5 py-3">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((student) => {
                  const total = totalFor(student.id);
                  const grade = gradeFor(total, settings.grading);
                  const position = [...totals].sort((a, b) => b - a).indexOf(total) + 1;
                  return (
                    <tr key={student.id} className="transition-colors hover:bg-upwa-canvas/50">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={`${student.firstName} ${student.lastName}`} size="sm" />
                          <span className="font-medium text-slate-800">{student.lastName}, {student.firstName}</span>
                        </div>
                      </td>
                      {(["ca1", "ca2", "exam"] as const).map((field) => (
                        <td key={field} className="px-3 py-2.5 text-center">
                          <input
                            aria-label={`${field.toUpperCase()} for ${fullName(student)}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={field === "exam" ? settings.examMax : settings.caMax}
                            step={1}
                            value={draft[student.id]?.[field] ?? "0"}
                            onChange={(event) => clampField(student.id, field, event.target.value)}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm font-semibold outline-none transition-colors focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-display text-base font-bold text-upwa-navy">{total}</td>
                      <td className="px-5 py-2.5 text-center">
                        <Badge tone={grade.grade.startsWith("F") ? "red" : grade.grade.startsWith("A") ? "green" : "blue"}>
                          {grade.grade}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-xs font-semibold text-slate-600">{ordinal(position)} of {roster.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DataTable
        rows={sheetRows}
        columns={[
          { key: "subject", header: "Subject", sortValue: (row) => row.subject.name, searchValue: (row) => `${row.subject.name} ${row.subject.code}`, render: (row) => (
            <div>
              <p className="font-semibold text-slate-800">{row.subject.name}</p>
              <p className="font-mono text-[11px] text-slate-500">{row.subject.code}</p>
            </div>
          ) },
          { key: "entries", header: "Marks entered", align: "center", sortValue: (row) => row.entries, render: (row) => (
            <Badge tone={row.entries === roster.length ? "green" : row.entries > 0 ? "orange" : "neutral"}>
              {row.entries} / {roster.length}
            </Badge>
          ) },
          { key: "average", header: "Class average", align: "center", sortValue: (row) => row.average, render: (row) => <span className="font-semibold text-slate-800">{row.average || "—"}</span> },
          { key: "best", header: "Highest", align: "center", sortValue: (row) => row.best, render: (row) => <span className="text-slate-600">{row.best || "—"}</span> },
          { key: "grade", header: "Average grade", align: "center", render: (row) => {
            const grade = gradeFor(row.average, settings.grading);
            return <Badge tone={grade.grade.startsWith("F") ? "red" : grade.grade.startsWith("A") ? "green" : "blue"}>{grade.grade} · {grade.remark}</Badge>;
          } },
        ]}
        getId={(row) => row.subject.id}
        title={`${activeClass} ${arm} — subject summary`}
        subtitle="Completeness of the broadsheet for this class and arm."
        searchPlaceholder="Search subjects…"
        pageSize={8}
      />
    </div>
  );
}

/* ================================= results =============================== */

function teacherRemark(position: number, size: number, average: number) {
  if (position === 1) return "An outstanding performance. A consistent and disciplined pupil — keep it up.";
  if (position <= 3) return "A very good result. With a little more revision, the top of the class is within reach.";
  if (average >= 65) return "A creditable performance. Encourage more reading at home to strengthen further.";
  if (average >= 50) return "Satisfactory progress. More attention to homework and class participation is advised.";
  if (average >= 40) return "A fair result, but this pupil can do better. Extra lessons are recommended.";
  return "Below expectation. Please meet the class teacher to agree a remedial plan.";
}

export function ResultsWorkspace() {
  const { data, notify } = useDemo();
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState("");

  if (!data) return null;
  const { students, subjects, scores, attendance, settings } = data;

  const availableClasses = classesWithData(students);
  const activeClass = className || availableClasses[0] || "Primary 1";
  const classRoster = students
    .filter((student) => student.className === activeClass && student.status === "ACTIVE")
    .sort((a, b) => a.lastName.localeCompare(b.lastName));
  const activeStudent = students.find((student) => student.id === studentId) ?? classRoster[0];

  if (!activeStudent) {
    return (
      <Card>
        <p className="py-10 text-center text-sm text-slate-500">No pupils in this class yet. Enrol a pupil first.</p>
      </Card>
    );
  }

  const studentScores = scores.filter((score) => score.studentId === activeStudent.id && score.term === settings.currentTerm);
  const aggregate = studentScores.reduce((sum, score) => sum + scoreTotal(score), 0);
  const average = studentScores.length ? Math.round((aggregate / studentScores.length) * 10) / 10 : 0;

  const peerAggregates = classRoster.map((peer) => ({
    studentId: peer.id,
    aggregate: scores.filter((score) => score.studentId === peer.id && score.term === settings.currentTerm).reduce((sum, score) => sum + scoreTotal(score), 0),
  }));
  const positions = classPositions(peerAggregates);
  const position = positions.get(activeStudent.id) ?? 1;
  const attendanceStats = attendanceSummary(attendance.filter((record) => record.studentId === activeStudent.id));
  const overallGrade = gradeFor(average, settings.grading);

  return (
    <div className="space-y-5">
      <Card className="print:hidden">
        <CardHeader
          title="Term report cards"
          subtitle="Select a pupil to preview the report their parent sees on the family portal. Reports are generated from saved broadsheets and cannot be edited here."
          icon={<FileText size={18} />}
          action={
            <Button variant="outline" size="sm" icon={<Printer size={15} />} onClick={() => { notify("Report sent to print preview", "info", "In the live product this produces a signed, watermarked PDF."); window.print(); }}>
              Print report
            </Button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Class</span>
            <Select value={activeClass} onChange={(event) => { setClassName(event.target.value); setStudentId(""); }}>
              {availableClasses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Pupil</span>
            <Select value={activeStudent.id} onChange={(event) => setStudentId(event.target.value)}>
              {classRoster.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.lastName}, {student.firstName} {student.otherName} — Arm {student.arm}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Card>

      {/* Report card */}
      <div className="overflow-hidden rounded-2xl border-2 border-upwa-navy/15 bg-white shadow-panel-lg">
        <div className="surface-navy flex flex-wrap items-center gap-5 px-6 py-6 text-white sm:px-8">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/95 p-1.5">
            <img src="/upwa-logo.png" alt="UPWA crest" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-upwa-orange-400">University of Port Harcourt Women Association</p>
            <h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">{settings.schoolName}</h2>
            <p className="mt-1 text-xs text-slate-300">University of Port Harcourt, Choba, Rivers State, Nigeria</p>
          </div>
          <div className="text-right">
            <p className="font-display text-base font-bold text-upwa-orange-400">Terminal Report</p>
            <p className="mt-1 text-xs text-slate-300">{termLabel(settings.currentTerm)} · {settings.session}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-upwa-canvas/60 px-6 py-4 text-xs sm:grid-cols-3 sm:px-8">
          <div><span className="text-slate-500">Pupil: </span><strong className="text-upwa-navy">{fullName(activeStudent)}</strong></div>
          <div><span className="text-slate-500">Admission No: </span><strong className="font-mono text-upwa-navy">{activeStudent.admissionNumber}</strong></div>
          <div><span className="text-slate-500">Class: </span><strong className="text-upwa-navy">{activeStudent.className} {activeStudent.arm}</strong></div>
          <div><span className="text-slate-500">House: </span><strong className="text-upwa-navy">{activeStudent.house}</strong></div>
          <div><span className="text-slate-500">Gender: </span><strong className="text-upwa-navy">{activeStudent.gender === "FEMALE" ? "Female" : "Male"}</strong></div>
          <div><span className="text-slate-500">Pupils in class: </span><strong className="text-upwa-navy">{classRoster.length}</strong></div>
        </div>

        <div className="overflow-x-auto px-6 py-6 sm:px-8">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-upwa-navy text-[10px] uppercase tracking-wider text-white">
                <th className="border border-upwa-navy px-3 py-2.5">Subject</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">CA1</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">CA2</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">Exam</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">Total</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">Grade</th>
                <th className="border border-upwa-navy px-3 py-2.5 text-center">Position</th>
                <th className="border border-upwa-navy px-3 py-2.5">Remark</th>
              </tr>
            </thead>
            <tbody>
              {studentScores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                    No marks have been saved for this pupil yet. Enter them in the Gradebook module.
                  </td>
                </tr>
              ) : (
                studentScores.map((score) => {
                  const subject = subjects.find((item) => item.id === score.subjectId);
                  const total = scoreTotal(score);
                  const grade = gradeFor(total, settings.grading);
                  const subjectTotals = classRoster
                    .map((peer) => scores.find((s) => s.studentId === peer.id && s.subjectId === score.subjectId && s.term === settings.currentTerm))
                    .filter(Boolean)
                    .map((s) => scoreTotal(s as Score));
                  const subjectPosition = subjectTotals.length
                    ? [...subjectTotals].sort((a, b) => b - a).indexOf(total) + 1
                    : 0;
                  return (
                    <tr key={score.id} className="even:bg-slate-50/70">
                      <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">{subject?.name ?? "—"}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{score.ca1}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{score.ca2}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{score.exam}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-bold text-upwa-navy">{total}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-800">{grade.grade}</td>
                      <td className="border border-slate-200 px-3 py-2 text-center text-slate-600">{subjectPosition ? ordinal(subjectPosition) : "—"}</td>
                      <td className="border border-slate-200 px-3 py-2 text-xs text-slate-600">{grade.remark}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {studentScores.length > 0 ? (
              <tfoot>
                <tr className="bg-upwa-canvas font-bold text-upwa-navy">
                  <td className="border border-slate-300 px-3 py-2.5">Aggregate / average</td>
                  <td className="border border-slate-300 px-3 py-2.5 text-center" colSpan={3}>{studentScores.length} subjects</td>
                  <td className="border border-slate-300 px-3 py-2.5 text-center">{aggregate}</td>
                  <td className="border border-slate-300 px-3 py-2.5 text-center">{overallGrade.grade}</td>
                  <td className="border border-slate-300 px-3 py-2.5 text-center" colSpan={2}>{ordinal(position)} of {classRoster.length} · average {average}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        <div className="grid gap-5 border-t border-slate-200 px-6 py-6 sm:px-8 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attendance</p>
            <p className="mt-2 font-display text-2xl font-bold text-upwa-navy">{attendanceStats.rate}%</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {attendanceStats.present} present · {attendanceStats.late} late · {attendanceStats.absent} absent · {attendanceStats.excused} excused out of {attendanceStats.total} school days.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class teacher&apos;s remark</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{teacherRemark(position, classRoster.length, average)}</p>
            <p className="mt-3 text-xs font-semibold text-upwa-navy">Mrs. Uchenna Aluu</p>
            <p className="text-[11px] text-slate-500">Class Teacher · signed electronically</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Head Teacher&apos;s remark</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {average >= 65
                ? "A commendable result. This pupil is a credit to the school."
                : average >= 45
                  ? "An acceptable result. Greater effort is needed next term."
                  : "This result requires serious attention. Parents should meet the Head Teacher."}
            </p>
            <p className="mt-3 text-xs font-semibold text-upwa-navy">Mrs. Chinwe Chike</p>
            <p className="text-[11px] text-slate-500">Head Teacher · signed electronically</p>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grading key</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.grading.map((band) => (
              <span key={band.grade} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
                {band.grade}: {band.min}–{band.grade === "F9" ? "39" : String((settings.grading.find((item) => item.min < band.min)?.min ?? 101) - 1)} {band.remark}
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <StatusBadge status="DRAFT" label="Demonstration report" />
            Generated from demonstration data. A live report carries a verification PIN that third parties can check against the school record.
          </p>
        </div>
      </div>
    </div>
  );
}
