"use client";

import { useMemo, useState } from "react";
import {
  BookMarked,
  CalendarDays,
  GraduationCap,
  Mail,
  MessageSquareText,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { useDemo } from "../store";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DataTable,
  DetailRow,
  Modal,
  Select,
  StatCard,
  StatusBadge,
  inputClass,
  type Column,
} from "../ui";
import { SchemaForm, blankFrom, coerceFrom, type FieldSchema, type FormValues } from "../form";
import { CLASS_ORDER, type Message, type SchoolEvent, type Subject, type TermCode } from "../types";
import { formatDate, relativeDay, termLabel, titleCase, weekdayOf } from "../format";

/* ============================ communications ============================= */

const AUDIENCES = [
  "All parents and guardians",
  "Parents with an outstanding balance",
  "Parents of Crèche & Nursery pupils",
  "Parents of Primary pupils",
  "Parents of JSS pupils",
  "Parents of SSS 3 candidates",
  "All teaching staff",
  "PTA executives",
];

export function CommunicationsWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [composing, setComposing] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [editing, setEditing] = useState<Message | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Message | null>(null);

  const messages = data?.messages ?? [];
  const students = data?.students ?? [];
  const guardians = data?.guardians ?? [];
  const staff = data?.staff ?? [];
  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];

  function audienceCount(audience: string) {
    if (audience === "All parents and guardians") return guardians.length;
    if (audience === "All teaching staff") return staff.length;
    if (audience === "PTA executives") return Math.max(1, Math.round(guardians.length * 0.12));
    if (audience === "Parents with an outstanding balance") {
      const owing = invoices.filter((invoice) => {
        const total = invoice.items.reduce((sum, item) => sum + item.amount, 0);
        const paid = payments.filter((p) => p.invoiceId === invoice.id && p.status === "CONFIRMED").reduce((sum, p) => sum + p.amount, 0);
        return paid < total;
      });
      return owing.length;
    }
    const matchClass = (predicate: (className: string) => boolean) =>
      new Set(students.filter((student) => predicate(student.className)).map((student) => student.guardianId)).size;
    if (audience === "Parents of Crèche & Nursery pupils") return matchClass((c) => ["Crèche", "Pre-Nursery", "Nursery 1", "Nursery 2"].includes(c));
    if (audience === "Parents of Primary pupils") return matchClass((c) => c.startsWith("Primary"));
    if (audience === "Parents of JSS pupils") return matchClass((c) => c.startsWith("JSS"));
    if (audience === "Parents of SSS 3 candidates") return matchClass((c) => c === "SSS 3");
    return guardians.length;
  }

  const schema: FieldSchema[] = useMemo(
    () => [
      { name: "subject", label: "Message subject", required: true, full: true, placeholder: "First term mid-term break notice" },
      { name: "channel", label: "Channel", type: "select", required: true, options: [
        { value: "SMS", label: "SMS only" },
        { value: "EMAIL", label: "Email only" },
        { value: "SMS_AND_EMAIL", label: "SMS and email" },
      ] },
      { name: "audience", label: "Audience", type: "select", required: true, options: AUDIENCES },
      { name: "body", label: "Message body", type: "textarea", required: true, full: true, placeholder: "Dear parent, …" },
    ],
    [],
  );

  if (!data) return null;

  function openCompose() {
    setValues(blankFrom(schema, { channel: "SMS_AND_EMAIL", audience: AUDIENCES[0] }));
    setComposing(true);
    setEditing(null);
  }

  function save(status: Message["status"]) {
    const next = coerceFrom(schema, values);
    const recipients = audienceCount(String(next.audience));
    if (editing) {
      update("messages", editing.id, { ...next, recipients, status } as unknown as Partial<Message>);
      notify("Message updated", "success", next.subject as string);
      setEditing(null);
      return;
    }
    create("messages", {
      ...(next as unknown as Omit<Message, "id" | "recipients" | "status" | "sentAt">),
      recipients,
      status,
      sentAt: status === "SENT" ? new Date().toISOString().slice(0, 10) : "",
    });
    notify(
      status === "SENT" ? "Broadcast delivered" : status === "SCHEDULED" ? "Broadcast scheduled" : "Draft saved",
      status === "SENT" ? "success" : "info",
      `${recipients} recipient${recipients === 1 ? "" : "s"} · ${titleCase(String(next.channel).replaceAll("_", " "))}`,
    );
    setComposing(false);
  }

  const sent = messages.filter((message) => message.status === "SENT");
  const reach = sent.reduce((sum, message) => sum + message.recipients, 0);

  const columns: Column<Message>[] = [
    {
      key: "subject",
      header: "Message",
      sortValue: (row) => row.subject,
      searchValue: (row) => `${row.subject} ${row.body} ${row.audience}`,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{row.subject}</p>
          <p className="truncate text-[11px] text-slate-500">{row.body}</p>
        </div>
      ),
    },
    { key: "channel", header: "Channel", hideBelow: "md", render: (row) => <Badge tone={row.channel === "EMAIL" ? "violet" : "blue"}>{row.channel.replaceAll("_", " + ")}</Badge> },
    { key: "audience", header: "Audience", hideBelow: "lg", render: (row) => <span className="text-slate-600">{row.audience}</span> },
    { key: "recipients", header: "Recipients", align: "right", sortValue: (row) => row.recipients, render: (row) => <span className="font-semibold text-slate-800">{row.recipients.toLocaleString("en-NG")}</span> },
    { key: "sent", header: "Date", hideBelow: "sm", sortValue: (row) => row.sentAt, render: (row) => <span className="text-slate-600">{row.sentAt ? formatDate(row.sentAt) : "—"}</span> },
    { key: "status", header: "Status", sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Broadcasts sent" value={String(sent.length)} note="This academic term" icon={<Send size={19} />} tone="green" />
        <StatCard label="Total reach" value={reach.toLocaleString("en-NG")} note="SMS and email deliveries" icon={<MessageSquareText size={19} />} />
        <StatCard label="Drafts & scheduled" value={String(messages.length - sent.length)} note="Awaiting release by the administrator" icon={<Mail size={19} />} tone="orange" />
        <StatCard label="Contactable parents" value={String(guardians.length)} note={`${guardians.filter((g) => g.email).length} with an email address`} icon={<Users size={19} />} tone="violet" />
      </div>

      <DataTable
        rows={messages}
        columns={columns}
        getId={(row) => row.id}
        title="Message log"
        subtitle="Everything the school has sent, scheduled or drafted — with the audience and delivery count."
        searchPlaceholder="Search subject, body or audience…"
        addLabel="Compose message"
        onAdd={openCompose}
        onView={setViewing}
        onEdit={(row) => { setValues({ subject: row.subject, channel: row.channel, audience: row.audience, body: row.body }); setEditing(row); setComposing(false); }}
        onDelete={setPendingDelete}
        pageSize={8}
        toolbar={
          <Select
            aria-label="Quick compose for an audience"
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              setValues(blankFrom(schema, { channel: "SMS_AND_EMAIL", audience: event.target.value, subject: `${event.target.value} — notice` }));
              setComposing(true);
            }}
          >
            <option value="">Compose for…</option>
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>{audience} ({audienceCount(audience)})</option>
            ))}
          </Select>
        }
      />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.subject ?? ""}
        subtitle={viewing ? `${titleCase(viewing.channel.replaceAll("_", " "))} · ${viewing.audience}` : undefined}
        footer={
          viewing ? (
            <>
              {viewing.status !== "SENT" ? (
                <Button variant="primary" icon={<Send size={15} />} onClick={() => {
                  update("messages", viewing.id, { status: "SENT", sentAt: new Date().toISOString().slice(0, 10) });
                  notify("Broadcast delivered", "success", `${viewing.recipients} recipients · ${viewing.subject}`);
                  setViewing(null);
                }}>
                  Send now
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => { setEditing(viewing); setValues({ subject: viewing.subject, channel: viewing.channel, audience: viewing.audience, body: viewing.body }); setViewing(null); }}>
                Edit
              </Button>
            </>
          ) : null
        }
      >
        {viewing ? (
          <div className="space-y-5">
            <dl>
              <DetailRow label="Status"><StatusBadge status={viewing.status} /></DetailRow>
              <DetailRow label="Channel">{titleCase(viewing.channel.replaceAll("_", " "))}</DetailRow>
              <DetailRow label="Audience">{viewing.audience}</DetailRow>
              <DetailRow label="Recipients">{viewing.recipients.toLocaleString("en-NG")}</DetailRow>
              <DetailRow label={viewing.status === "SENT" ? "Sent on" : "Scheduled"}>{viewing.sentAt ? formatDate(viewing.sentAt) : "Not released"}</DetailRow>
            </dl>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Message body</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{viewing.body}</p>
            </div>
            <p className="rounded-xl bg-upwa-blue-50 px-4 py-3 text-xs leading-5 text-upwa-blue-900">
              In the live product this broadcast is delivered through the configured SMS gateway and email provider, and
              delivery receipts are written back to each contact record. Nothing is sent from this demonstration.
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={composing || Boolean(editing)}
        onClose={() => { setComposing(false); setEditing(null); }}
        title={editing ? "Edit message" : "Compose a broadcast"}
        subtitle={`Reaching ${audienceCount(String(values.audience ?? AUDIENCES[0]))} recipient(s)`}
      >
        <SchemaForm
          schema={schema}
          value={values}
          onChange={setValues}
          onSubmit={() => save(editing ? (editing.status as Message["status"]) : "SENT")}
          onCancel={() => { setComposing(false); setEditing(null); }}
          submitLabel={editing ? "Save changes" : "Send broadcast"}
          note={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => save("DRAFT")}>Save as draft</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => save("SCHEDULED")}>Schedule for later</Button>
            </div>
          }
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this message?"
        body={pendingDelete ? `“${pendingDelete.subject}” will be removed from the log. Messages already delivered cannot be recalled.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("messages", pendingDelete.id);
            notify("Message deleted", "danger", pendingDelete.subject);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ============================== calendar ================================= */

const EVENT_TYPES: SchoolEvent["type"][] = ["ACADEMIC", "EXAMINATION", "CEREMONY", "HOLIDAY", "MEETING", "SPORTS", "PTA"];

export function CalendarWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<SchoolEvent | null>(null);

  const events = data?.events ?? [];
  const settings = data?.settings;

  const schema: FieldSchema[] = [
    { name: "title", label: "Event title", required: true, full: true, placeholder: "Inter-house sports" },
    { name: "type", label: "Type", type: "select", required: true, options: EVENT_TYPES },
    { name: "date", label: "Start date", type: "date", required: true },
    { name: "endDate", label: "End date (optional)", type: "date" },
    { name: "audience", label: "Audience", placeholder: "All pupils and parents" },
    { name: "venue", label: "Venue", placeholder: "School assembly ground" },
    { name: "description", label: "Description", type: "textarea", full: true },
  ];

  if (!data || !settings) return null;

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((event) => event.date >= today);
  const past = sorted.filter((event) => event.date < today).reverse();

  function submit() {
    const next = coerceFrom(schema, values);
    if (editing) {
      update("events", editing.id, next as unknown as Partial<SchoolEvent>);
      notify("Event updated", "success", String(next.title));
      setEditing(null);
      return;
    }
    create("events", next as unknown as Omit<SchoolEvent, "id">);
    notify("Event added to the calendar", "success", `${next.title} · ${formatDate(String(next.date))}`);
    setCreating(false);
  }

  const typeTone = (type: string) =>
    type === "EXAMINATION" ? "red" : type === "HOLIDAY" ? "violet" : type === "CEREMONY" ? "orange" : type === "PTA" || type === "MEETING" ? "neutral" : "blue";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Term" value={termLabel(settings.currentTerm)} note={`${settings.session} · ${formatDate(settings.termStartDate)} to ${formatDate(settings.termEndDate)}`} icon={<CalendarDays size={19} />} />
        <StatCard label="Upcoming events" value={String(upcoming.length)} note={upcoming[0] ? `Next: ${upcoming[0].title} (${relativeDay(upcoming[0].date)})` : "Nothing scheduled"} icon={<Send size={19} />} tone="green" />
        <StatCard label="Examinations" value={String(events.filter((event) => event.type === "EXAMINATION").length)} note="Papers published a week ahead" icon={<GraduationCap size={19} />} tone="orange" />
        <StatCard label="Next term begins" value={formatDate(settings.nextTermBegins)} note={`${weekdayOf(settings.nextTermBegins)} · resumption`} icon={<RotateCcw size={19} />} tone="violet" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="font-display text-base font-bold text-upwa-navy">Upcoming</h3>
              <p className="mt-0.5 text-xs text-slate-500">Published to the family portal and the public website calendar.</p>
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => { setValues(blankFrom(schema, { type: "ACADEMIC", date: upcoming[0]?.date ?? today })); setCreating(true); setEditing(null); }}>
              Add event
            </Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {upcoming.length === 0 ? (
              <li className="px-5 py-12 text-center text-sm text-slate-500">No upcoming events. Add one to see how the calendar behaves.</li>
            ) : (
              upcoming.map((event) => (
                <li key={event.id} className="group flex flex-wrap items-start gap-4 px-5 py-4 transition-colors hover:bg-upwa-canvas/50">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-upwa-canvas text-upwa-navy">
                    <span className="font-display text-lg font-bold leading-none">{new Date(`${event.date}T00:00:00`).getDate()}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase">{new Date(`${event.date}T00:00:00`).toLocaleDateString("en-NG", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{event.title}</p>
                      <Badge tone={typeTone(event.type) as never}>{titleCase(event.type)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {weekdayOf(event.date)} · {relativeDay(event.date)}
                      {event.venue && event.venue !== "—" ? ` · ${event.venue}` : ""}
                      {event.endDate ? ` · ends ${formatDate(event.endDate)}` : ""}
                    </p>
                    {event.description ? <p className="mt-2 text-xs leading-5 text-slate-600">{event.description}</p> : null}
                    <p className="mt-1.5 text-[11px] text-slate-400">Audience: {event.audience}</p>
                  </div>
                  <div className="flex gap-1.5 opacity-70 transition-opacity group-hover:opacity-100">
                    <Button size="sm" variant="outline" onClick={() => { setValues({ title: event.title, type: event.type, date: event.date, endDate: event.endDate, audience: event.audience, venue: event.venue, description: event.description }); setEditing(event); setCreating(false); }}>Edit</Button>
                    <Button size="sm" variant="dangerOutline" icon={<Trash2 size={14} />} onClick={() => setPendingDelete(event)} aria-label={`Delete ${event.title}`} />
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Term dates" subtitle="Set once per session and shown on every parent receipt." icon={<SlidersHorizontal size={18} />} />
            <dl>
              <DetailRow label="Session">{settings.session}</DetailRow>
              <DetailRow label="Current term">{termLabel(settings.currentTerm)}</DetailRow>
              <DetailRow label="Term begins">{formatDate(settings.termStartDate)}</DetailRow>
              <DetailRow label="Term ends">{formatDate(settings.termEndDate)}</DetailRow>
              <DetailRow label="Next term">{formatDate(settings.nextTermBegins)}</DetailRow>
              <DetailRow label="Attendance target">{settings.attendanceTarget}%</DetailRow>
            </dl>
          </Card>

          <Card padded={false}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-display text-base font-bold text-upwa-navy">Already held</h3>
              <p className="mt-0.5 text-xs text-slate-500">Kept for the session record.</p>
            </div>
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {past.length === 0 ? (
                <li className="px-5 py-8 text-center text-sm text-slate-500">Nothing held yet this term.</li>
              ) : (
                past.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{event.title}</p>
                      <p className="text-[11px] text-slate-500">{formatDate(event.date)}</p>
                    </div>
                    <Badge tone={typeTone(event.type) as never}>{titleCase(event.type)}</Badge>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      </div>

      <DataTable
        rows={events}
        columns={[
          { key: "title", header: "Event", sortValue: (row) => row.title, searchValue: (row) => `${row.title} ${row.description} ${row.audience} ${row.venue}`, render: (row) => <span className="font-semibold text-slate-800">{row.title}</span> },
          { key: "date", header: "Date", sortValue: (row) => row.date, render: (row) => <span className="text-slate-600">{formatDate(row.date)}</span> },
          { key: "type", header: "Type", render: (row) => <Badge tone={typeTone(row.type) as never}>{titleCase(row.type)}</Badge> },
          { key: "audience", header: "Audience", hideBelow: "md", render: (row) => <span className="text-slate-600">{row.audience}</span> },
          { key: "venue", header: "Venue", hideBelow: "lg", render: (row) => <span className="text-slate-600">{row.venue || "—"}</span> },
        ]}
        getId={(row) => row.id}
        title="Full calendar"
        searchPlaceholder="Search the calendar…"
        pageSize={6}
        onEdit={(row) => { setValues({ title: row.title, type: row.type, date: row.date, endDate: row.endDate, audience: row.audience, venue: row.venue, description: row.description }); setEditing(row); setCreating(false); }}
        onDelete={setPendingDelete}
      />

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Edit event" : "Add a calendar event"}
        subtitle="Events appear on the family portal, the public website and in the automated reminder schedule."
      >
        <SchemaForm schema={schema} value={values} onChange={setValues} onSubmit={submit} onCancel={() => { setCreating(false); setEditing(null); }} submitLabel={editing ? "Save event" : "Add to calendar"} />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this event?"
        body={pendingDelete ? `“${pendingDelete.title}” on ${formatDate(pendingDelete.date)} will be removed from the school calendar.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("events", pendingDelete.id);
            notify("Event removed", "danger", pendingDelete.title);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* =============================== curriculum ============================== */

export function SubjectsWorkspace() {
  const { data, create, update, remove, notify } = useDemo();
  const [editing, setEditing] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [pendingDelete, setPendingDelete] = useState<Subject | null>(null);

  const subjects = data?.subjects ?? [];
  const staff = data?.staff ?? [];
  const students = data?.students ?? [];
  const scores = data?.scores ?? [];

  const schema: FieldSchema[] = useMemo(
    () => [
      { name: "code", label: "Subject code", required: true, placeholder: "MTH", hint: "Used on broadsheets and report cards." },
      { name: "name", label: "Subject name", required: true, placeholder: "Mathematics" },
      {
        name: "level",
        label: "Level",
        type: "select",
        required: true,
        options: ["EARLY_YEARS", "LOWER_PRIMARY", "UPPER_PRIMARY", "JUNIOR_SECONDARY", "SENIOR_SECONDARY"].map((value) => ({ value, label: titleCase(value.replaceAll("_", " ")) })),
      },
      {
        name: "teacherId",
        label: "Assigned teacher",
        type: "select",
        options: staff.map((member) => ({ value: member.id, label: `${member.title} ${member.firstName} ${member.lastName}` })),
      },
      { name: "classList", label: "Classes (comma separated)", full: true, placeholder: "JSS 1, JSS 2, JSS 3", hint: `Available: ${CLASS_ORDER.join(", ")}` },
    ],
    [staff],
  );

  if (!data) return null;

  function submit() {
    const next = coerceFrom(schema, values);
    const classes = String(next.classList)
      .split(",")
      .map((item) => item.trim())
      .filter((item) => (CLASS_ORDER as readonly string[]).includes(item)) as Subject["classes"];
    const payload = {
      code: String(next.code).toUpperCase(),
      name: String(next.name),
      level: next.level as Subject["level"],
      teacherId: String(next.teacherId) || staff[0]?.id || "",
      classes,
    };
    if (editing) {
      update("subjects", editing.id, payload);
      notify("Subject updated", "success", `${payload.code} — ${payload.name}`);
      setEditing(null);
      return;
    }
    create("subjects", payload);
    notify("Subject added", "success", `${payload.code} — ${payload.name}`);
    setCreating(false);
  }

  const columns: Column<Subject>[] = [
    {
      key: "name",
      header: "Subject",
      sortValue: (row) => row.name,
      searchValue: (row) => `${row.name} ${row.code} ${row.level}`,
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.name}</p>
          <p className="font-mono text-[11px] text-slate-500">{row.code}</p>
        </div>
      ),
    },
    { key: "level", header: "Level", render: (row) => <Badge tone="blue">{titleCase(row.level.replaceAll("_", " "))}</Badge> },
    {
      key: "classes",
      header: "Classes",
      hideBelow: "md",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.classes.slice(0, 3).map((item) => (
            <span key={item} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{item}</span>
          ))}
          {row.classes.length > 3 ? <span className="text-[10px] text-slate-400">+{row.classes.length - 3}</span> : null}
        </div>
      ),
    },
    {
      key: "teacher",
      header: "Teacher",
      hideBelow: "lg",
      render: (row) => {
        const teacher = staff.find((member) => member.id === row.teacherId);
        return <span className="text-slate-700">{teacher ? `${teacher.title} ${teacher.firstName} ${teacher.lastName}` : "Unassigned"}</span>;
      },
    },
    {
      key: "pupils",
      header: "Pupils",
      align: "right",
      sortValue: (row) => scores.filter((score) => score.subjectId === row.id).length,
      render: (row) => <Badge tone="neutral">{scores.filter((score) => score.subjectId === row.id).length} marks</Badge>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subjects on the timetable" value={String(subjects.length)} note="Across all levels" icon={<BookMarked size={19} />} />
        <StatCard label="Senior secondary" value={String(subjects.filter((s) => s.level === "SENIOR_SECONDARY").length)} note="WAEC / NECO subject offerings" icon={<GraduationCap size={19} />} tone="violet" />
        <StatCard label="Junior & primary" value={String(subjects.filter((s) => ["JUNIOR_SECONDARY", "LOWER_PRIMARY", "UPPER_PRIMARY"].includes(s.level)).length)} note="Nigerian UBE / NERDC curriculum" icon={<BookMarked size={19} />} tone="green" />
        <StatCard label="Pupils covered" value={String(students.filter((s) => s.status === "ACTIVE").length)} note="Each pupil sits the subjects for their class" icon={<Users size={19} />} tone="orange" />
      </div>

      <DataTable
        rows={subjects}
        columns={columns}
        getId={(row) => row.id}
        title="Subjects & curriculum"
        subtitle="Subject codes drive the broadsheet, the report card and the grade computation."
        searchPlaceholder="Search subject or code…"
        addLabel="Add subject"
        onAdd={() => { setValues(blankFrom(schema, { level: "SENIOR_SECONDARY", teacherId: staff[0]?.id ?? "", classList: "SSS 1, SSS 2, SSS 3" })); setCreating(true); setEditing(null); }}
        onEdit={(row) => { setValues({ code: row.code, name: row.name, level: row.level, teacherId: row.teacherId, classList: row.classes.join(", ") }); setEditing(row); setCreating(false); }}
        onDelete={setPendingDelete}
        pageSize={10}
      />

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? `Edit ${editing.name}` : "Add a subject"}
      >
        <SchemaForm schema={schema} value={values} onChange={setValues} onSubmit={submit} onCancel={() => { setCreating(false); setEditing(null); }} submitLabel={editing ? "Save subject" : "Add subject"} />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this subject?"
        body={pendingDelete ? `${pendingDelete.name} (${pendingDelete.code}) will be removed from the curriculum. Marks already recorded against it are kept so past reports remain intact.` : ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove("subjects", pendingDelete.id);
            notify("Subject deleted", "danger", `${pendingDelete.code} — ${pendingDelete.name}`);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/* ================================ settings =============================== */

export function SettingsWorkspace() {
  const { data, updateSettings, reset, notify } = useDemo();
  const [profile, setProfile] = useState<FormValues>({});
  const [editingBand, setEditingBand] = useState<number | null>(null);
  const [bandValues, setBandValues] = useState<FormValues>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const settings = data?.settings;
  if (!data || !settings) return null;

  const profileValues: FormValues = Object.keys(profile).length
    ? profile
    : {
        schoolName: settings.schoolName,
        session: settings.session,
        currentTerm: settings.currentTerm,
        termStartDate: settings.termStartDate,
        termEndDate: settings.termEndDate,
        nextTermBegins: settings.nextTermBegins,
        attendanceTarget: settings.attendanceTarget,
        caMax: settings.caMax,
        examMax: settings.examMax,
      };

  const profileSchema: FieldSchema[] = [
    { name: "schoolName", label: "School name", required: true, full: true },
    { name: "session", label: "Academic session", required: true, placeholder: "2026/2027" },
    { name: "currentTerm", label: "Current term", type: "select", options: [
      { value: "FIRST", label: "First Term" },
      { value: "SECOND", label: "Second Term" },
      { value: "THIRD", label: "Third Term" },
    ] },
    { name: "termStartDate", label: "Term begins", type: "date" },
    { name: "termEndDate", label: "Term ends", type: "date" },
    { name: "nextTermBegins", label: "Next term begins", type: "date" },
    { name: "attendanceTarget", label: "Attendance target (%)", type: "number", min: 50, max: 100 },
    { name: "caMax", label: "Each CA out of", type: "number", min: 5, max: 40 },
    { name: "examMax", label: "Examination out of", type: "number", min: 20, max: 80 },
  ];

  function saveProfile() {
    const next = coerceFrom(profileSchema, profileValues);
    updateSettings({
      schoolName: String(next.schoolName),
      session: String(next.session),
      currentTerm: String(next.currentTerm) as TermCode,
      termStartDate: String(next.termStartDate),
      termEndDate: String(next.termEndDate),
      nextTermBegins: String(next.nextTermBegins),
      attendanceTarget: Number(next.attendanceTarget),
      caMax: Number(next.caMax),
      examMax: Number(next.examMax),
    });
    setProfile({});
    notify("School settings saved", "success", `${next.session} · ${termLabel(String(next.currentTerm))}`);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="School profile & academic session"
          subtitle="These settings drive invoice labels, report card headers, attendance targets and the grading scale."
          icon={<Settings2 size={18} />}
          action={<Button variant="primary" size="sm" onClick={saveProfile}>Save settings</Button>}
        />
        <SchemaForm
          schema={profileSchema}
          value={profileValues}
          onChange={setProfile}
          onSubmit={saveProfile}
          submitLabel="Save settings"
        />
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-upwa-navy">Grading scheme</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Nigerian secondary-school style bands. CA is out of {settings.caMax} each and the examination out of {settings.examMax}, totalling {settings.caMax * 2 + settings.examMax}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => {
              const lowest = Math.min(...settings.grading.map((band) => band.min));
              updateSettings({ grading: [...settings.grading, { min: Math.max(0, lowest - 5), grade: "—", remark: "New band" }] });
              notify("Band added", "info", "Set the minimum score, grade and remark, then save.");
            }}
          >
            Add band
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Minimum score</th>
                <th className="px-5 py-3">Grade</th>
                <th className="px-5 py-3">Interpretation</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...settings.grading]
                .sort((a, b) => b.min - a.min)
                .map((band) => {
                  const index = settings.grading.indexOf(band);
                  const editing = editingBand === index;
                  return (
                    <tr key={`${band.grade}-${band.min}-${index}`} className="transition-colors hover:bg-upwa-canvas/50">
                      {(["min", "grade", "remark"] as const).map((field) => (
                        <td key={field} className="px-5 py-2.5">
                          {editing ? (
                            <input
                              aria-label={`${field} for band ${band.grade}`}
                              type={field === "min" ? "number" : "text"}
                              value={String(bandValues[field] ?? band[field])}
                              onChange={(event) => setBandValues((current) => ({ ...current, [field]: field === "min" ? Number(event.target.value) : event.target.value }))}
                              className={field === "min" ? "w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-upwa-blue-500" : `${inputClass} !py-1.5`}
                            />
                          ) : (
                            <span className={field === "grade" ? "font-display font-bold text-upwa-navy" : field === "min" ? "font-semibold text-slate-800" : "text-slate-600"}>
                              {field === "min" ? `${band.min}+` : band[field]}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-2">
                          {editing ? (
                            <>
                              <Button size="sm" variant="primary" onClick={() => {
                                const next = [...settings.grading];
                                next[index] = {
                                  min: Number(bandValues.min ?? band.min),
                                  grade: String(bandValues.grade ?? band.grade),
                                  remark: String(bandValues.remark ?? band.remark),
                                };
                                updateSettings({ grading: next });
                                setEditingBand(null);
                                notify("Grading band saved", "success", `${bandValues.grade ?? band.grade} — ${bandValues.remark ?? band.remark}`);
                              }}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingBand(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setEditingBand(index); setBandValues({ min: band.min, grade: band.grade, remark: band.remark }); }}>Edit</Button>
                              <Button
                                size="sm"
                                variant="dangerOutline"
                                aria-label={`Delete band ${band.grade}`}
                                icon={<Trash2 size={14} />}
                                onClick={() => {
                                  if (settings.grading.length <= 1) {
                                    notify("At least one band is required", "danger", "The grading scheme cannot be empty.");
                                    return;
                                  }
                                  updateSettings({ grading: settings.grading.filter((_, position) => position !== index) });
                                  notify("Grading band removed", "danger", band.grade);
                                }}
                              />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-rose-200 bg-rose-50/40">
        <CardHeader
          title="Reset the demonstration"
          subtitle="Restores every pupil, score, invoice and message to the original seeded state and clears this browser's saved copy."
          icon={<RotateCcw size={18} />}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="danger" icon={<RotateCcw size={15} />} onClick={() => setConfirmReset(true)}>
            Reset demonstration data
          </Button>
          <p className="text-xs leading-5 text-slate-600">
            Useful between client presentations so each viewer starts from the same clean dataset.
          </p>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all demonstration data?"
        body="Every change made in this browser — new pupils, edited marks, recorded payments and composed messages — will be discarded and the original dataset restored."
        confirmLabel="Reset data"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setProfile({});
          reset();
        }}
      />
    </div>
  );
}
