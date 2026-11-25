"use client";

import { useState } from "react";
import {
  ArrowRight,
  Baby,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Inbox,
  Phone,
  School,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useDemo } from "../store";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DetailRow,
  Modal,
  StatCard,
  StatusBadge,
  TabBar,
  type Column,
} from "../ui";
import { SchemaForm, blankFrom, coerceFrom, type FieldSchema, type FormValues } from "../form";
import {
  CLASS_ARMS,
  CLASS_ORDER,
  HOUSES,
  divisionOfClass,
  type AdmissionApplication,
  type Guardian,
  type SchoolClass,
  type Staff,
  type Student,
} from "../types";
import {
  ageFromDob,
  attendanceSummary,
  confirmedPayments,
  formatDate,
  fullName,
  gradeFor,
  invoiceStatus,
  invoiceTotal,
  naira,
  scoreTotal,
  termLabel,
} from "../format";

/* ================================ pupils ================================= */

export function StudentsWorkspace() {
  const { data, create, update, remove, replaceAll, notify } = useDemo();
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [viewing, setViewing] = useState<Student | null>(null);
  const [viewTab, setViewTab] = useState("profile");
  const [editing, setEditing] = useState<Student | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);

  if (!data) return null;

  const { students, guardians, attendance, scores, subjects, invoices, payments, settings } = data;

  const rows = students.filter(
    (student) =>
      (!classFilter || student.className === classFilter) &&
      (!statusFilter || student.status === statusFilter),
  );

  const guardianOf = (student: Student) => guardians.find((guardian) => guardian.id === student.guardianId);

  function statsFor(student: Student) {
    const present = attendanceSummary(attendance.filter((record) => record.studentId === student.id));
    const invoice = invoices.find((item) => item.studentId === student.id);
    const paid = invoice ? confirmedPayments(payments, invoice.id) : 0;
    const total = invoice ? invoiceTotal(invoice) : 0;
    return { attendance: present, balance: Math.max(0, total - paid), invoice };
  }

  const activeStudents = students.filter((student) => student.status === "ACTIVE");
  const girls = activeStudents.filter((student) => student.gender === "FEMALE").length;
  const boys = activeStudents.length - girls;
  const averageAttendance = attendance.length
    ? Math.round((attendance.filter((record) => record.status !== "ABSENT").length / attendance.length) * 1000) / 10
    : 0;
  const totalOutstanding = activeStudents.reduce((sum, student) => sum + statsFor(student).balance, 0);

  const schema: FieldSchema[] = [
      { name: "firstName", label: "First name", required: true, placeholder: "Chiamaka" },
      { name: "otherName", label: "Middle / other name", placeholder: "Amaka" },
      { name: "lastName", label: "Surname", required: true, placeholder: "Okafor" },
      { name: "gender", label: "Gender", type: "select", options: ["FEMALE", "MALE"], required: true },
      { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      { name: "className", label: "Class", type: "select", options: [...CLASS_ORDER], required: true },
      { name: "arm", label: "Arm", type: "select", options: [...CLASS_ARMS], required: true },
      { name: "house", label: "House", type: "select", options: [...HOUSES] },
      {
        name: "guardianId",
        label: "Parent / guardian",
        type: "select",
        required: true,
        options: guardians.map((guardian) => ({ value: guardian.id, label: `${guardian.title} ${guardian.fullName} — ${guardian.phone}` })),
        hint: "New parents can be added from the Guardians module.",
      },
      { name: "stateOfOrigin", label: "State of origin", placeholder: "Rivers" },
      { name: "admissionDate", label: "Admission date", type: "date" },
      { name: "address", label: "Residential address", type: "textarea", full: true, placeholder: "12 Rumuigbo Road, Obio-Akpor" },
      { name: "status", label: "Enrolment status", type: "select", options: ["ACTIVE", "GRADUATED", "WITHDRAWN", "SUSPENDED"] },
      { name: "medicalNote", label: "Medical note for the school nurse", type: "textarea", full: true, placeholder: "Allergies, medication or seating needs" },
    ];

  function openCreate() {
    setValues(
      blankFrom(schema, {
        gender: "FEMALE",
        arm: "A",
        house: HOUSES[0],
        className: "Primary 1",
        status: "ACTIVE",
        admissionDate: settings.termStartDate,
      }),
    );
    setCreating(true);
    setEditing(null);
  }

  function openEdit(student: Student) {
    setValues({
      firstName: student.firstName,
      otherName: student.otherName,
      lastName: student.lastName,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      className: student.className,
      arm: student.arm,
      house: student.house,
      guardianId: student.guardianId,
      stateOfOrigin: student.stateOfOrigin,
      admissionDate: student.admissionDate,
      address: student.address,
      status: student.status,
      medicalNote: student.medicalNote,
    });
    setEditing(student);
    setCreating(false);
  }

  function submitForm() {
    const next = coerceFrom(schema, values);
    if (editing) {
      update("students", editing.id, next as unknown as Partial<Student>);
      notify("Pupil record updated", "success", `${next.firstName} ${next.lastName} — ${next.className} ${next.arm}`);
      setEditing(null);
      return;
    }
    const division = divisionOfClass(String(next.className) as SchoolClass);
    const year = settings.session.split("/")[0];
    const record = create("students", {
      ...(next as unknown as Omit<Student, "id">),
      admissionNumber: `UPWA/${division === "SECONDARY" ? "SEC" : "PRY"}/${year}/${String(students.length + 101).padStart(4, "0")}`,
    });
    notify("Pupil enrolled", "success", `${record.admissionNumber} — ${record.firstName} ${record.lastName}`);
    setCreating(false);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const student = pendingDelete;
    remove("students", student.id);
    replaceAll("attendance", attendance.filter((record) => record.studentId !== student.id));
    replaceAll("scores", scores.filter((record) => record.studentId !== student.id));
    const removedInvoice = invoices.find((invoice) => invoice.studentId === student.id);
    replaceAll("invoices", invoices.filter((invoice) => invoice.studentId !== student.id));
    replaceAll("payments", payments.filter((payment) => payment.studentId !== student.id));
    notify("Pupil record deleted", "danger", `Attendance, scores, invoice and payments for ${fullName(student)} were also removed.`);
    setPendingDelete(null);
    if (viewing?.id === student.id) setViewing(null);
    void removedInvoice;
  }

  const columns: Column<Student>[] = [
    {
      key: "pupil",
      header: "Pupil",
      sortValue: (row) => `${row.lastName} ${row.firstName}`,
      searchValue: (row) => `${row.firstName} ${row.otherName} ${row.lastName} ${row.admissionNumber}`,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.firstName} ${row.lastName}`} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">
              {row.lastName}, {row.firstName} {row.otherName}
            </p>
            <p className="truncate font-mono text-[11px] text-slate-500">{row.admissionNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: "class",
      header: "Class",
      sortValue: (row) => CLASS_ORDER.indexOf(row.className) * 10 + CLASS_ARMS.indexOf(row.arm),
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.className}</p>
          <p className="text-[11px] text-slate-500">Arm {row.arm} · {row.house.replace(" House", "")}</p>
        </div>
      ),
    },
    {
      key: "guardian",
      header: "Parent / guardian",
      hideBelow: "md",
      searchValue: (row) => guardianOf(row)?.fullName ?? "",
      render: (row) => {
        const guardian = guardianOf(row);
        if (!guardian) return <span className="text-slate-400">—</span>;
        return (
          <div>
            <p className="font-medium text-slate-800">{guardian.title} {guardian.fullName}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Phone size={10} /> {guardian.phone}
            </p>
          </div>
        );
      },
    },
    {
      key: "age",
      header: "Age / sex",
      hideBelow: "lg",
      sortValue: (row) => row.dateOfBirth,
      render: (row) => (
        <span className="text-slate-600">
          {ageFromDob(row.dateOfBirth)} · {row.gender === "FEMALE" ? "Female" : "Male"}
        </span>
      ),
    },
    {
      key: "attendance",
      header: "Attendance",
      align: "right",
      hideBelow: "sm",
      sortValue: (row) => statsFor(row).attendance.rate,
      render: (row) => {
        const rate = statsFor(row).attendance.rate;
        const tone = rate >= settings.attendanceTarget ? "text-upwa-green-700" : rate >= 80 ? "text-upwa-orange-700" : "text-rose-600";
        return <span className={`font-semibold ${tone}`}>{rate}%</span>;
      },
    },
    {
      key: "fees",
      header: "Fees",
      hideBelow: "sm",
      sortValue: (row) => statsFor(row).balance,
      render: (row) => {
        const { balance, invoice } = statsFor(row);
        if (!invoice) return <Badge tone="neutral">No invoice</Badge>;
        return balance === 0 ? (
          <StatusBadge status="PAID" label="Cleared" />
        ) : (
          <div>
            <StatusBadge status={balance < invoiceTotal(invoice) ? "PART_PAYMENT" : "OUTSTANDING"} label={balance < invoiceTotal(invoice) ? "Part paid" : "Owing"} />
            <p className="mt-1 text-[11px] font-semibold text-slate-600">{naira(balance)}</p>
          </div>
        );
      },
    },
    { key: "status", header: "Status", hideBelow: "xl", render: (row) => <StatusBadge status={row.status} /> },
  ];

  const viewingStats = viewing ? statsFor(viewing) : null;
  const viewingScores = viewing ? scores.filter((score) => score.studentId === viewing.id) : [];
  const viewingInvoice = viewing ? invoices.find((invoice) => invoice.studentId === viewing.id) : undefined;
  const viewingPayments = viewing ? payments.filter((payment) => payment.studentId === viewing.id) : [];
  const classPeers = viewing
    ? students.filter((student) => student.className === viewing.className && student.arm === viewing.arm && student.status === "ACTIVE")
    : [];
  const aggregateFor = (studentId: string) =>
    scores.filter((score) => score.studentId === studentId).reduce((sum, score) => sum + scoreTotal(score), 0);
  const viewingPosition = viewing
    ? classPeers
        .map((peer) => ({ id: peer.id, aggregate: aggregateFor(peer.id) }))
        .sort((a, b) => b.aggregate - a.aggregate)
        .findIndex((row) => row.id === viewing.id) + 1
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pupils enrolled" value={String(activeStudents.length)} note={`${boys} boys · ${girls} girls across ${new Set(activeStudents.map((s) => s.className)).size} classes`} icon={<Users size={19} />} />
        <StatCard label="Early years & primary" value={String(activeStudents.filter((s) => divisionOfClass(s.className) === "PRIMARY_EARLY_YEARS").length)} note="Crèche through Primary 6" icon={<Baby size={19} />} tone="green" />
        <StatCard label="Secondary" value={String(activeStudents.filter((s) => divisionOfClass(s.className) === "SECONDARY").length)} note="JSS 1 through SSS 3" icon={<GraduationCap size={19} />} tone="violet" />
        <StatCard label="Attendance this term" value={`${averageAttendance}%`} note={`Target ${settings.attendanceTarget}% · ${attendance.length} register entries`} icon={<UserCheck size={19} />} tone="orange" />
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        title="Pupil register"
        subtitle={`${settings.session} · ${termLabel(settings.currentTerm)}`}
        searchPlaceholder="Search by name or admission number…"
        addLabel="Enrol a pupil"
        onAdd={openCreate}
        onView={(row) => {
          setViewing(row);
          setViewTab("profile");
        }}
        onEdit={openEdit}
        onDelete={setPendingDelete}
        toolbar={
          <>
            <select
              aria-label="Filter by class"
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-upwa-blue-500"
            >
              <option value="">All classes</option>
              {CLASS_ORDER.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-upwa-blue-500"
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="GRADUATED">Graduated</option>
              <option value="WITHDRAWN">Withdrawn</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </>
        }
        emptyTitle="No pupils match these filters"
        emptyBody="Adjust the class or status filter, or enrol a pupil to populate the register."
      />

      {totalOutstanding > 0 ? (
        <Card className="border-upwa-orange-200 bg-upwa-orange-50/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-upwa-orange-100 text-upwa-orange-800">
                <CreditCard size={19} />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-upwa-navy">
                  {naira(totalOutstanding)} outstanding across the school
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Bursary can send a reminder from Communications, or record a payment from Fees & Payments.
                </p>
              </div>
            </div>
            <Badge tone="orange">{activeStudents.filter((s) => statsFor(s).balance > 0).length} families owing</Badge>
          </div>
        </Card>
      ) : null}

      {/* View pupil */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="lg"
        title={viewing ? `${viewing.firstName} ${viewing.otherName} ${viewing.lastName}` : ""}
        subtitle={viewing ? `${viewing.admissionNumber} · ${viewing.className} ${viewing.arm} · ${viewing.house}` : undefined}
        footer={
          viewing ? (
            <>
              <Button variant="dangerOutline" onClick={() => { setPendingDelete(viewing); setViewing(null); }}>
                Delete record
              </Button>
              <Button variant="primary" onClick={() => { openEdit(viewing); setViewing(null); }}>
                Edit pupil
              </Button>
            </>
          ) : null
        }
      >
        {viewing && viewingStats ? (
          <div className="space-y-5">
            <TabBar
              active={viewTab}
              onChange={setViewTab}
              tabs={[
                { key: "profile", label: "Profile" },
                { key: "guardian", label: "Guardian" },
                { key: "academics", label: "Academics", count: viewingScores.length },
                { key: "attendance", label: "Attendance" },
                { key: "fees", label: "Fees" },
              ]}
            />

            {viewTab === "profile" ? (
              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-upwa-canvas p-5 sm:w-48">
                  <Avatar name={`${viewing.firstName} ${viewing.lastName}`} size="lg" />
                  <p className="text-center font-display text-sm font-bold text-upwa-navy">{fullName(viewing)}</p>
                  <StatusBadge status={viewing.status} />
                </div>
                <dl className="flex-1">
                  <DetailRow label="Admission number"><span className="font-mono">{viewing.admissionNumber}</span></DetailRow>
                  <DetailRow label="Date of birth">{formatDate(viewing.dateOfBirth)} ({ageFromDob(viewing.dateOfBirth)})</DetailRow>
                  <DetailRow label="Gender">{viewing.gender === "FEMALE" ? "Female" : "Male"}</DetailRow>
                  <DetailRow label="Class and arm">{viewing.className} · Arm {viewing.arm}</DetailRow>
                  <DetailRow label="Division">{divisionOfClass(viewing.className) === "SECONDARY" ? "Secondary" : "Early Years & Primary"}</DetailRow>
                  <DetailRow label="House">{viewing.house}</DetailRow>
                  <DetailRow label="State of origin">{viewing.stateOfOrigin}</DetailRow>
                  <DetailRow label="Admitted">{formatDate(viewing.admissionDate)}</DetailRow>
                  <DetailRow label="Address">{viewing.address}</DetailRow>
                  {viewing.medicalNote ? <DetailRow label="Medical note"><span className="text-rose-700">{viewing.medicalNote}</span></DetailRow> : null}
                </dl>
              </div>
            ) : null}

            {viewTab === "guardian" ? (
              (() => {
                const guardian = guardianOf(viewing);
                if (!guardian) return <p className="text-sm text-slate-500">No guardian linked to this pupil.</p>;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-2xl bg-upwa-canvas p-5">
                      <Avatar name={guardian.fullName} size="lg" />
                      <div>
                        <p className="font-display text-base font-bold text-upwa-navy">{guardian.title} {guardian.fullName}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{guardian.relationship} · {guardian.occupation}</p>
                      </div>
                    </div>
                    <dl>
                      <DetailRow label="Phone"><a className="text-upwa-blue-700 underline-offset-2 hover:underline" href={`tel:${guardian.phone.replace(/\s/g, "")}`}>{guardian.phone}</a></DetailRow>
                      <DetailRow label="Email"><a className="text-upwa-blue-700 underline-offset-2 hover:underline" href={`mailto:${guardian.email}`}>{guardian.email}</a></DetailRow>
                      <DetailRow label="Address">{guardian.address}</DetailRow>
                      <DetailRow label="Other wards in school">
                        {students.filter((s) => s.guardianId === guardian.id && s.id !== viewing.id).map((sibling) => `${sibling.firstName} (${sibling.className} ${sibling.arm})`).join(", ") || "None"}
                      </DetailRow>
                    </dl>
                  </div>
                );
              })()
            ) : null}

            {viewTab === "academics" ? (
              viewingScores.length === 0 ? (
                <p className="text-sm text-slate-500">No scores recorded for this term yet. Use the Gradebook module to enter continuous assessment and examination marks.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Subject</th>
                        <th className="px-4 py-2.5 text-center">CA1</th>
                        <th className="px-4 py-2.5 text-center">CA2</th>
                        <th className="px-4 py-2.5 text-center">Exam</th>
                        <th className="px-4 py-2.5 text-center">Total</th>
                        <th className="px-4 py-2.5 text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingScores.map((score) => {
                        const subject = subjects.find((item) => item.id === score.subjectId);
                        const total = scoreTotal(score);
                        const grade = gradeFor(total, settings.grading);
                        return (
                          <tr key={score.id}>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{subject?.name ?? "Unknown subject"}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">{score.ca1}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">{score.ca2}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">{score.exam}</td>
                            <td className="px-4 py-2.5 text-center font-bold text-upwa-navy">{total}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge tone={grade.grade.startsWith("F") ? "red" : grade.grade.startsWith("A") ? "green" : "blue"}>
                                {grade.grade} · {grade.remark}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-upwa-canvas">
                      <tr>
                        <td className="px-4 py-3 font-bold text-upwa-navy" colSpan={4}>
                          Aggregate ({viewingScores.length} subjects) · Class position {viewingPosition} of {classPeers.length}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-upwa-navy">{aggregateFor(viewing.id)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            ) : null}

            {viewTab === "attendance" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Present", value: viewingStats.attendance.present, tone: "text-upwa-green-700" },
                    { label: "Late", value: viewingStats.attendance.late, tone: "text-upwa-orange-700" },
                    { label: "Absent", value: viewingStats.attendance.absent, tone: "text-rose-600" },
                    { label: "Excused", value: viewingStats.attendance.excused, tone: "text-violet-700" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 p-4 text-center">
                      <p className={`font-display text-2xl font-bold ${item.tone}`}>{item.value}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  Attendance rate this term: <strong className="font-semibold text-upwa-navy">{viewingStats.attendance.rate}%</strong> across {viewingStats.attendance.total} school days recorded.
                </p>
              </div>
            ) : null}

            {viewTab === "fees" ? (
              viewingInvoice ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-slate-700">{viewingInvoice.invoiceNumber}</p>
                      <StatusBadge status={invoiceStatus(viewingInvoice, payments)} />
                    </div>
                    <ul className="divide-y divide-slate-100 px-4">
                      {viewingInvoice.items.map((item) => (
                        <li key={item.label} className="flex items-center justify-between py-2.5 text-sm">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-semibold text-slate-800">{naira(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between border-t border-slate-200 bg-upwa-canvas px-4 py-3">
                      <span className="text-sm font-bold text-upwa-navy">Total billed</span>
                      <span className="font-display text-base font-bold text-upwa-navy">{naira(invoiceTotal(viewingInvoice))}</span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments received</p>
                    {viewingPayments.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No payment recorded for this invoice.</p>
                    ) : (
                      <ul className="space-y-2">
                        {viewingPayments.map((payment) => (
                          <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{naira(payment.amount)}</p>
                              <p className="font-mono text-[11px] text-slate-500">{payment.receiptNumber} · {payment.reference}</p>
                            </div>
                            <div className="text-right">
                              <StatusBadge status={payment.status} />
                              <p className="mt-1 text-[11px] text-slate-500">{formatDate(payment.paidAt)} · {payment.bank}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-upwa-navy px-5 py-4 text-white">
                    <span className="text-sm font-semibold">Outstanding balance</span>
                    <span className="font-display text-xl font-bold">{naira(viewingStats.balance)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No invoice has been raised for this pupil this term.</p>
              )
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Create / edit pupil */}
      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : "Enrol a new pupil"}
        subtitle={editing ? editing.admissionNumber : "A new admission number is generated automatically on save."}
      >
        <SchemaForm
          schema={schema}
          value={values}
          onChange={setValues}
          onSubmit={submitForm}
          onCancel={() => { setCreating(false); setEditing(null); }}
          submitLabel={editing ? "Save changes" : "Enrol pupil"}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this pupil record?"
        body={
          pendingDelete
            ? `${fullName(pendingDelete)} (${pendingDelete.admissionNumber}) will be removed together with their attendance entries, subject scores, invoice and payment history. In the live product this is a restricted action that only an administrator can perform and is written to the audit log.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/* =============================== guardians =============================== */

export function GuardiansWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<Guardian | null>(null);

  if (!data) return null;
  const { guardians, students } = data;

  const schema: FieldSchema[] = [
    { name: "title", label: "Title", type: "select", options: ["Mr.", "Mrs.", "Miss", "Ms.", "Dr.", "Engr.", "Alhaji", "Chief", "Pastor"], required: true },
    { name: "fullName", label: "Full name", required: true, placeholder: "Ngozi Okafor" },
    { name: "relationship", label: "Relationship to pupil", type: "select", options: ["Mother", "Father", "Guardian", "Aunt", "Uncle"], required: true },
    { name: "phone", label: "Phone number", type: "tel", required: true, placeholder: "0803 412 7789" },
    { name: "email", label: "Email address", type: "email", placeholder: "parent@gmail.com" },
    { name: "occupation", label: "Occupation", placeholder: "Civil servant" },
    { name: "address", label: "Residential address", type: "textarea", full: true },
  ];

  const wardsOf = (guardianId: string) => students.filter((student) => student.guardianId === guardianId);

  function openCreate() {
    setValues(blankFrom(schema, { title: "Mrs.", relationship: "Mother" }));
    setCreating(true);
    setEditing(null);
  }

  function submit() {
    const next = coerceFrom(schema, values);
    if (editing) {
      update("guardians", editing.id, next as unknown as Partial<Guardian>);
      notify("Guardian updated", "success", String(next.fullName));
      setEditing(null);
      return;
    }
    create("guardians", next as unknown as Omit<Guardian, "id">);
    notify("Guardian added", "success", `${next.title} ${next.fullName}`);
    setCreating(false);
  }

  const columns: Column<Guardian>[] = [
    {
      key: "name",
      header: "Parent / guardian",
      sortValue: (row) => row.fullName,
      searchValue: (row) => `${row.title} ${row.fullName} ${row.phone} ${row.email} ${row.occupation}`,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.fullName} />
          <div>
            <p className="font-semibold text-slate-800">{row.title} {row.fullName}</p>
            <p className="text-[11px] text-slate-500">{row.relationship} · {row.occupation}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      hideBelow: "md",
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.phone}</p>
          <p className="truncate text-[11px] text-slate-500">{row.email}</p>
        </div>
      ),
    },
    { key: "address", header: "Address", hideBelow: "lg", render: (row) => <span className="text-slate-600">{row.address}</span> },
    {
      key: "wards",
      header: "Wards",
      align: "right",
      sortValue: (row) => wardsOf(row.id).length,
      render: (row) => {
        const wards = wardsOf(row.id);
        return (
          <div className="text-right">
            <Badge tone={wards.length ? "blue" : "neutral"}>{wards.length} pupil{wards.length === 1 ? "" : "s"}</Badge>
            {wards.length ? <p className="mt-1 truncate text-[11px] text-slate-500">{wards.map((w) => `${w.firstName} ${w.className}${w.arm}`).join(", ")}</p> : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <DataTable
        rows={guardians}
        columns={columns}
        getId={(row) => row.id}
        title="Parents & guardians directory"
        subtitle="Contact records used for SMS and email broadcasts, pickup authorisation and fee reminders."
        searchPlaceholder="Search name, phone or email…"
        addLabel="Add guardian"
        onAdd={openCreate}
        onEdit={(row) => {
          setValues({ title: row.title, fullName: row.fullName, relationship: row.relationship, phone: row.phone, email: row.email, occupation: row.occupation, address: row.address });
          setEditing(row);
          setCreating(false);
        }}
        onDelete={(row) => (wardsOf(row.id).length ? notify("Cannot delete", "danger", `${row.fullName} is linked to ${wardsOf(row.id).length} pupil record(s). Reassign or remove them first.`) : setPendingDelete(row))}
        pageSize={10}
      />

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.title} ${editing.fullName}` : "Add a parent or guardian"}
      >
        <SchemaForm
          schema={schema}
          value={values}
          onChange={setValues}
          onSubmit={submit}
          onCancel={() => { setCreating(false); setEditing(null); }}
          submitLabel={editing ? "Save changes" : "Add guardian"}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this guardian?"
        body={pendingDelete ? `${pendingDelete.title} ${pendingDelete.fullName} will be removed from the directory. This contact will no longer receive school broadcasts.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("guardians", pendingDelete.id);
            notify("Guardian deleted", "danger", pendingDelete.fullName);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ================================= staff ================================= */

export function StaffWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<Staff | null>(null);

  if (!data) return null;
  const { staff, subjects } = data;

  const schema: FieldSchema[] = [
    { name: "title", label: "Title", type: "select", options: ["Mr.", "Mrs.", "Miss", "Ms.", "Dr.", "Engr.", "Pastor"], required: true },
    { name: "firstName", label: "First name", required: true },
    { name: "lastName", label: "Surname", required: true },
    { name: "gender", label: "Gender", type: "select", options: ["FEMALE", "MALE"], required: true },
    {
      name: "role",
      label: "Role",
      type: "select",
      required: true,
      options: ["Head Teacher", "Principal", "Vice Principal", "Class Teacher", "Subject Teacher", "Bursar", "Administrator", "Counsellor", "ICT Officer"],
    },
    { name: "subject", label: "Subject taught", placeholder: "Mathematics (use — if none)" },
    { name: "assignedClass", label: "Assigned class / unit", placeholder: "Primary 4A" },
    { name: "phone", label: "Phone number", type: "tel", required: true },
    { name: "email", label: "Work email", type: "email" },
    { name: "employmentDate", label: "Employment date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["ACTIVE", "ON_LEAVE", "RESIGNED"] },
  ];

  function submit() {
    const next = coerceFrom(schema, values);
    if (editing) {
      update("staff", editing.id, next as unknown as Partial<Staff>);
      notify("Staff record updated", "success", `${next.title} ${next.firstName} ${next.lastName}`);
      setEditing(null);
      return;
    }
    const record = create("staff", {
      ...(next as unknown as Omit<Staff, "id" | "staffNumber">),
      staffNumber: `UPWA/STF/${String(staff.length + 21).padStart(3, "0")}`,
    });
    notify("Staff member added", "success", `${record.staffNumber} — ${record.firstName} ${record.lastName}`);
    setCreating(false);
  }

  const columns: Column<Staff>[] = [
    {
      key: "name",
      header: "Staff member",
      sortValue: (row) => `${row.lastName} ${row.firstName}`,
      searchValue: (row) => `${row.title} ${row.firstName} ${row.lastName} ${row.role} ${row.subject} ${row.staffNumber}`,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.firstName} ${row.lastName}`} />
          <div>
            <p className="font-semibold text-slate-800">{row.title} {row.firstName} {row.lastName}</p>
            <p className="font-mono text-[11px] text-slate-500">{row.staffNumber}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (row) => <Badge tone={row.role.includes("Principal") || row.role === "Head Teacher" ? "navy" : "blue"}>{row.role}</Badge> },
    { key: "subject", header: "Subject / assignment", hideBelow: "md", render: (row) => (
      <div>
        <p className="text-slate-800">{row.subject}</p>
        <p className="text-[11px] text-slate-500">{row.assignedClass}</p>
      </div>
    ) },
    { key: "phone", header: "Contact", hideBelow: "lg", render: (row) => (
      <div>
        <p className="text-slate-800">{row.phone}</p>
        <p className="truncate text-[11px] text-slate-500">{row.email}</p>
      </div>
    ) },
    {
      key: "subjects",
      header: "Subjects",
      align: "right",
      hideBelow: "xl",
      sortValue: (row) => subjects.filter((subject) => subject.teacherId === row.id).length,
      render: (row) => <Badge tone="neutral">{subjects.filter((subject) => subject.teacherId === row.id).length} assigned</Badge>,
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Teaching & non-teaching staff" value={String(staff.length)} note={`${staff.filter((s) => s.status === "ACTIVE").length} currently active`} icon={<School size={19} />} />
        <StatCard label="Class teachers" value={String(staff.filter((s) => s.role === "Class Teacher").length)} note="One per class arm" icon={<UserCheck size={19} />} tone="green" />
        <StatCard label="Subject teachers" value={String(staff.filter((s) => s.role === "Subject Teacher").length)} note={`${subjects.length} subjects on the timetable`} icon={<GraduationCap size={19} />} tone="violet" />
        <StatCard label="Leadership" value={String(staff.filter((s) => ["Head Teacher", "Principal", "Vice Principal"].includes(s.role)).length)} note="Head Teacher (primary) · Principal (secondary)" icon={<Users size={19} />} tone="orange" />
      </div>

      <DataTable
        rows={staff}
        columns={columns}
        getId={(row) => row.id}
        title="Staff directory"
        subtitle="Roles, subject assignments and contact details."
        searchPlaceholder="Search staff, role or subject…"
        addLabel="Add staff member"
        onAdd={() => { setValues(blankFrom(schema, { title: "Mrs.", gender: "FEMALE", role: "Subject Teacher", status: "ACTIVE" })); setCreating(true); setEditing(null); }}
        onEdit={(row) => {
          setValues({ title: row.title, firstName: row.firstName, lastName: row.lastName, gender: row.gender, role: row.role, subject: row.subject, assignedClass: row.assignedClass, phone: row.phone, email: row.email, employmentDate: row.employmentDate, status: row.status });
          setEditing(row);
          setCreating(false);
        }}
        onDelete={setPendingDelete}
        pageSize={10}
      />

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.title} ${editing.firstName} ${editing.lastName}` : "Add a staff member"}
        subtitle={editing ? editing.staffNumber : "A staff number is generated automatically on save."}
      >
        <SchemaForm schema={schema} value={values} onChange={setValues} onSubmit={submit} onCancel={() => { setCreating(false); setEditing(null); }} submitLabel={editing ? "Save changes" : "Add staff member"} />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this staff member?"
        body={pendingDelete ? `${pendingDelete.title} ${pendingDelete.firstName} ${pendingDelete.lastName} will lose portal access. Subjects assigned to them should be reassigned to another teacher.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("staff", pendingDelete.id);
            notify("Staff member removed", "danger", `${pendingDelete.firstName} ${pendingDelete.lastName}`);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ============================== admissions =============================== */

const PIPELINE: AdmissionApplication["status"][] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "EXAM_SCHEDULED",
  "OFFER_MADE",
  "ENROLLED",
];

const PIPELINE_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  EXAM_SCHEDULED: "Entrance exam booked",
  OFFER_MADE: "Offer made",
  ENROLLED: "Enrolled",
  WAITLISTED: "Waitlisted",
  DECLINED: "Declined",
};

export function AdmissionsWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [viewing, setViewing] = useState<AdmissionApplication | null>(null);
  const [editing, setEditing] = useState<AdmissionApplication | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<AdmissionApplication | null>(null);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");

  if (!data) return null;
  const { applications, guardians, students } = data;

  const schema: FieldSchema[] = [
    { name: "firstName", label: "Applicant first name", required: true },
    { name: "lastName", label: "Applicant surname", required: true },
    { name: "gender", label: "Gender", type: "select", options: ["FEMALE", "MALE"], required: true },
    { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
    { name: "applyingFor", label: "Applying for class", type: "select", options: [...CLASS_ORDER], required: true },
    { name: "status", label: "Stage", type: "select", options: [...PIPELINE, "WAITLISTED", "DECLINED"], required: true },
    { name: "guardianName", label: "Parent / guardian name", required: true },
    { name: "guardianPhone", label: "Guardian phone", type: "tel", required: true },
    { name: "guardianEmail", label: "Guardian email", type: "email" },
    { name: "previousSchool", label: "Previous school", placeholder: "—" },
    { name: "submittedAt", label: "Date submitted", type: "date" },
    { name: "examDate", label: "Entrance exam date", type: "date" },
    { name: "examVenue", label: "Exam venue" },
    { name: "note", label: "Admissions officer note", type: "textarea", full: true },
  ];

  function submit() {
    const next = coerceFrom(schema, values);
    if (editing) {
      update("applications", editing.id, next as unknown as Partial<AdmissionApplication>);
      notify("Application updated", "success", `${next.firstName} ${next.lastName} — ${PIPELINE_LABEL[String(next.status)]}`);
      setEditing(null);
      return;
    }
    const record = create("applications", {
      ...(next as unknown as Omit<AdmissionApplication, "id" | "applicationNumber">),
      applicationNumber: `UPWA/APP/${new Date().getFullYear()}/${String(applications.length + 501).padStart(4, "0")}`,
    });
    notify("Application logged", "success", record.applicationNumber);
    setCreating(false);
  }

  function openApplicationForm() {
    setValues(
      blankFrom(schema, {
        gender: "FEMALE",
        status: "SUBMITTED",
        applyingFor: "Nursery 1",
        submittedAt: new Date().toISOString().slice(0, 10),
      }),
    );
    setCreating(true);
    setEditing(null);
  }

  function advance(application: AdmissionApplication) {
    const index = PIPELINE.indexOf(application.status);
    const nextStatus = PIPELINE[Math.min(index + 1, PIPELINE.length - 1)];
    if (nextStatus === application.status) {
      notify("Already at the final stage", "info", "Use Enrol to create a pupil record from this application.");
      return;
    }
    update("applications", application.id, { status: nextStatus });
    notify("Stage advanced", "success", `${application.firstName} ${application.lastName} moved to ${PIPELINE_LABEL[nextStatus]}.`);
  }

  function enrol(application: AdmissionApplication) {
    const guardian = guardians[0];
    create("students", {
      admissionNumber: `UPWA/${divisionOfClass(application.applyingFor) === "SECONDARY" ? "SEC" : "PRY"}/${new Date().getFullYear()}/${String(students.length + 101).padStart(4, "0")}`,
      firstName: application.firstName,
      otherName: "",
      lastName: application.lastName,
      gender: application.gender,
      dateOfBirth: application.dateOfBirth,
      className: application.applyingFor,
      arm: "A",
      house: HOUSES[students.length % HOUSES.length],
      guardianId: guardian.id,
      address: "To be confirmed by admissions",
      stateOfOrigin: "—",
      admissionDate: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
      medicalNote: "",
    });
    update("applications", application.id, { status: "ENROLLED", note: `${application.note ? `${application.note} · ` : ""}Enrolled into ${application.applyingFor} A.` });
    notify("Pupil enrolled", "success", `${application.firstName} ${application.lastName} now appears in the pupil register.`);
  }

  const columns: Column<AdmissionApplication>[] = [
    {
      key: "applicant",
      header: "Applicant",
      sortValue: (row) => `${row.lastName} ${row.firstName}`,
      searchValue: (row) => `${row.firstName} ${row.lastName} ${row.applicationNumber} ${row.guardianName} ${row.guardianPhone}`,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={`${row.firstName} ${row.lastName}`} />
          <div>
            <p className="font-semibold text-slate-800">{row.firstName} {row.lastName}</p>
            <p className="font-mono text-[11px] text-slate-500">{row.applicationNumber}</p>
          </div>
        </div>
      ),
    },
    { key: "class", header: "Applying for", sortValue: (row) => CLASS_ORDER.indexOf(row.applyingFor), render: (row) => <span className="font-medium text-slate-800">{row.applyingFor}</span> },
    { key: "guardian", header: "Guardian", hideBelow: "md", render: (row) => (
      <div>
        <p className="text-slate-800">{row.guardianName}</p>
        <p className="text-[11px] text-slate-500">{row.guardianPhone}</p>
      </div>
    ) },
    { key: "exam", header: "Entrance exam", hideBelow: "lg", render: (row) => (
      row.examDate ? (
        <div>
          <p className="flex items-center gap-1 text-slate-800"><CalendarClock size={12} /> {formatDate(row.examDate)}</p>
          <p className="text-[11px] text-slate-500">{row.examVenue}</p>
        </div>
      ) : <span className="text-slate-400">Not scheduled</span>
    ) },
    { key: "submitted", header: "Submitted", hideBelow: "xl", sortValue: (row) => row.submittedAt, render: (row) => <span className="text-slate-600">{formatDate(row.submittedAt)}</span> },
    { key: "status", header: "Stage", sortValue: (row) => PIPELINE.indexOf(row.status), render: (row) => <StatusBadge status={row.status} label={PIPELINE_LABEL[row.status]} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Applications this cycle" value={String(applications.length)} note="Current admission round" icon={<Inbox size={19} />} />
        <StatCard label="Awaiting review" value={String(applications.filter((a) => ["SUBMITTED", "UNDER_REVIEW"].includes(a.status)).length)} note="Submitted or under review" icon={<CalendarClock size={19} />} tone="orange" />
        <StatCard label="Exam scheduled" value={String(applications.filter((a) => a.status === "EXAM_SCHEDULED").length)} note="Entrance assessment booked" icon={<UserCheck size={19} />} tone="violet" />
        <StatCard label="Offers & enrolments" value={String(applications.filter((a) => ["OFFER_MADE", "ENROLLED"].includes(a.status)).length)} note={`${applications.filter((a) => a.status === "ENROLLED").length} already enrolled`} icon={<UserPlus size={19} />} tone="green" />
      </div>

      <TabBar
        active={view}
        onChange={(key) => setView(key as "pipeline" | "table")}
        tabs={[
          { key: "pipeline", label: "Pipeline board" },
          { key: "table", label: "Full list", count: applications.length },
        ]}
      />

      {view === "pipeline" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-panel">
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-upwa-navy">Admissions pipeline</h3>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-slate-500">
                Move each applicant forward one stage at a time. When an offer is accepted, “Enrol pupil” writes the child
                straight onto the pupil register with a generated admission number.
              </p>
            </div>
            <Button variant="primary" size="sm" icon={<UserPlus size={15} />} onClick={openApplicationForm}>
              Log an application
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {PIPELINE.map((stage) => {
            const stageRows = applications.filter((application) => application.status === stage);
            return (
              <div key={stage} className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{PIPELINE_LABEL[stage]}</p>
                  <Badge tone={stage === "ENROLLED" ? "green" : "neutral"}>{stageRows.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {stageRows.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-[11px] text-slate-400">
                      Nothing at this stage
                    </p>
                  ) : (
                    stageRows.map((application) => (
                      <article key={application.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-panel">
                        <div className="flex items-start gap-2.5">
                          <Avatar name={`${application.firstName} ${application.lastName}`} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{application.firstName} {application.lastName}</p>
                            <p className="truncate text-[11px] text-slate-500">→ {application.applyingFor} · {application.gender === "FEMALE" ? "F" : "M"}</p>
                          </div>
                        </div>
                        <p className="mt-2 truncate font-mono text-[10px] text-slate-400">{application.applicationNumber}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => setViewing(application)} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200">View</button>
                          {stage !== "ENROLLED" ? (
                            <button type="button" onClick={() => advance(application)} className="inline-flex items-center gap-1 rounded-lg bg-upwa-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-upwa-blue-800 transition-colors hover:bg-upwa-blue-100">
                              Advance <ArrowRight size={11} />
                            </button>
                          ) : (
                            <button type="button" onClick={() => enrol(application)} className="inline-flex items-center gap-1 rounded-lg bg-upwa-green-50 px-2.5 py-1.5 text-[11px] font-semibold text-upwa-green-800 transition-colors hover:bg-upwa-green-100">
                              Enrol pupil <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </>
      ) : (
        <DataTable
          rows={applications}
          columns={columns}
          getId={(row) => row.id}
          title="Admission applications"
          searchPlaceholder="Search applicant, reference or guardian…"
          addLabel="Log an application"
          onAdd={openApplicationForm}
          onView={setViewing}
          onEdit={(row) => {
            setValues({ ...row } as unknown as FormValues);
            setEditing(row);
            setCreating(false);
          }}
          onDelete={setPendingDelete}
          pageSize={8}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(["WAITLISTED", "DECLINED"] as const).map((stage) => {
          const stageRows = applications.filter((application) => application.status === stage);
          return (
            <Card key={stage}>
              <CardHeader
                title={PIPELINE_LABEL[stage]}
                subtitle={stage === "WAITLISTED" ? "No vacancy in the requested class arm this session." : "Did not meet the entrance requirement for the class applied for."}
                icon={<Inbox size={18} />}
                action={<Badge tone={stage === "DECLINED" ? "red" : "orange"}>{stageRows.length}</Badge>}
              />
              {stageRows.length === 0 ? (
                <p className="text-sm text-slate-500">No applications at this stage.</p>
              ) : (
                <ul className="space-y-2">
                  {stageRows.map((application) => (
                    <li key={application.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{application.firstName} {application.lastName}</p>
                        <p className="truncate text-[11px] text-slate-500">{application.applyingFor} · {application.note || "No note recorded"}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setViewing(application)}>Open</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.firstName} ${viewing.lastName}` : ""}
        subtitle={viewing ? `${viewing.applicationNumber} · applying for ${viewing.applyingFor}` : undefined}
        footer={
          viewing ? (
            <>
              <Button variant="dangerOutline" onClick={() => { setPendingDelete(viewing); setViewing(null); }}>Decline & delete</Button>
              <Button variant="outline" onClick={() => advance(viewing)}>Advance stage</Button>
              <Button variant="primary" onClick={() => { setEditing(viewing); setViewing(null); }}>Edit application</Button>
            </>
          ) : null
        }
      >
        {viewing ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-upwa-canvas p-4">
              <Avatar name={`${viewing.firstName} ${viewing.lastName}`} size="lg" />
              <div>
                <p className="font-display text-base font-bold text-upwa-navy">{viewing.firstName} {viewing.lastName}</p>
                <p className="text-xs text-slate-600">{viewing.gender === "FEMALE" ? "Female" : "Male"} · born {formatDate(viewing.dateOfBirth)} ({ageFromDob(viewing.dateOfBirth)})</p>
              </div>
              <div className="ml-auto"><StatusBadge status={viewing.status} label={PIPELINE_LABEL[viewing.status]} /></div>
            </div>
            <dl>
              <DetailRow label="Applying for class">{viewing.applyingFor}</DetailRow>
              <DetailRow label="Division">{divisionOfClass(viewing.applyingFor) === "SECONDARY" ? "Secondary" : "Early Years & Primary"}</DetailRow>
              <DetailRow label="Date submitted">{formatDate(viewing.submittedAt)}</DetailRow>
              <DetailRow label="Previous school">{viewing.previousSchool || "—"}</DetailRow>
              <DetailRow label="Entrance exam">{viewing.examDate ? `${formatDate(viewing.examDate)} — ${viewing.examVenue}` : "Not scheduled"}</DetailRow>
              <DetailRow label="Guardian">{viewing.guardianName}</DetailRow>
              <DetailRow label="Guardian phone">{viewing.guardianPhone}</DetailRow>
              <DetailRow label="Guardian email">{viewing.guardianEmail || "—"}</DetailRow>
              <DetailRow label="Admissions note">{viewing.note || "—"}</DetailRow>
            </dl>
            {viewing.status === "OFFER_MADE" ? (
              <div className="rounded-2xl border border-upwa-green-200 bg-upwa-green-50 p-4">
                <p className="text-sm font-semibold text-upwa-green-900">Offer ready to accept</p>
                <p className="mt-1 text-xs leading-5 text-upwa-green-800">
                  Use <strong>Enrol pupil</strong> on the pipeline board to convert this application into a pupil record with its own admission number.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : "Log an admission application"}
        subtitle={editing ? editing.applicationNumber : "Use this when a family applies in person or by phone."}
      >
        <SchemaForm schema={schema} value={values} onChange={setValues} onSubmit={submit} onCancel={() => { setCreating(false); setEditing(null); }} submitLabel={editing ? "Save changes" : "Log application"} />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this application?"
        body={pendingDelete ? `Application ${pendingDelete.applicationNumber} for ${pendingDelete.firstName} ${pendingDelete.lastName} will be permanently removed from the admissions pipeline.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("applications", pendingDelete.id);
            notify("Application deleted", "danger", pendingDelete.applicationNumber);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
