import { Activity, Cpu, HeartHandshake, Inbox, School, Wallet } from "lucide-react";
import { confirmedPayments, formatDate, invoiceStatus, invoiceTotal, naira } from "./format";
import type { DemoData } from "./types";

/**
 * Single source of truth for everything the President's Office reports.
 *
 * The dashboard, the PDF briefs and the email dispatch all read from this one
 * computation, so the numbers on screen and the numbers in her inbox can never
 * disagree.
 */

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};
export const mondayOf = (d: Date) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

export function computePresidentBrief(data: DemoData) {
  const { students, attendance, payments, expenses, invoices, applications, events, messages, staff, settings, scores, subjects } = data;
  const now = new Date();
  const today = iso(now);

  const registerDates = Array.from(new Set(attendance.map((record) => record.date))).sort();
  const latestRegister = registerDates[registerDates.length - 1] ?? today;
  const registerIsToday = latestRegister === today;
  const register = attendance.filter((record) => record.date === latestRegister);
  const present = register.filter((record) => record.status === "PRESENT").length;
  const late = register.filter((record) => record.status === "LATE").length;
  const absent = register.filter((record) => record.status === "ABSENT").length;
  const excused = register.filter((record) => record.status === "EXCUSED").length;
  const attendanceRate = register.length ? Math.round(((present + late) / register.length) * 100) : 0;
  const termAttendance = attendance.length
    ? Math.round(((attendance.filter((record) => record.status !== "ABSENT").length) / attendance.length) * 100)
    : 0;

  const paidToday = payments.filter((payment) => payment.status === "CONFIRMED" && payment.paidAt === today);
  const pending = payments.filter((payment) => payment.status === "PENDING_REVIEW");
  const spentToday = expenses.filter((expense) => expense.date === today);

  const billed = invoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
  const collected = payments.filter((payment) => payment.status === "CONFIRMED").reduce((sum, payment) => sum + payment.amount, 0);
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cash = settings.openingBalance + collected - spent;
  const collectionRate = billed ? Math.round((collected / billed) * 100) : 0;
  const spendRate = billed ? Math.round((spent / billed) * 100) : 0;

  const overdue = invoices.filter((invoice) => invoiceStatus(invoice, payments) === "OVERDUE");
  const overdueValue = overdue.reduce((sum, invoice) => sum + Math.max(0, invoiceTotal(invoice) - confirmedPayments(payments, invoice.id)), 0);
  const instalmentDue = invoices.filter((invoice) => invoice.dueDate === settings.termEndDate && invoiceStatus(invoice, payments) !== "PAID");
  const instalmentValue = instalmentDue.reduce((sum, invoice) => sum + Math.max(0, invoiceTotal(invoice) - confirmedPayments(payments, invoice.id)), 0);

  /* weekly buckets from the first Monday on or before term start */
  const firstMonday = mondayOf(new Date(`${settings.termStartDate}T09:00:00`));
  const weeks: { label: string; start: Date; income: number; spend: number }[] = [];
  for (let cursor = new Date(firstMonday); cursor <= now; cursor = addDays(cursor, 7)) {
    const end = addDays(cursor, 7);
    weeks.push({
      label: formatDate(iso(cursor)).replace(/ \d{4}$/, ""),
      start: new Date(cursor),
      income: payments
        .filter((payment) => payment.status === "CONFIRMED" && new Date(`${payment.paidAt}T09:00:00`) >= cursor && new Date(`${payment.paidAt}T09:00:00`) < end)
        .reduce((sum, payment) => sum + payment.amount, 0),
      spend: expenses
        .filter((expense) => new Date(`${expense.date}T09:00:00`) >= cursor && new Date(`${expense.date}T09:00:00`) < end)
        .reduce((sum, expense) => sum + expense.amount, 0),
    });
  }
  const weeklyChart = weeks.map((week) => ({ ...week, net: week.income - week.spend }));

  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  /* this week vs last week */
  const thisMonday = mondayOf(now);
  const lastMonday = addDays(thisMonday, -7);
  const inWindow = (date: string, from: Date, to: Date) => {
    const d = new Date(`${date}T09:00:00`);
    return d >= from && d < to;
  };
  const weekStats = (from: Date, to: Date) => {
    const recs = attendance.filter((record) => inWindow(record.date, from, to));
    const rate = recs.length
      ? Math.round((recs.filter((record) => record.status !== "ABSENT").length / recs.length) * 100)
      : 0;
    return {
      rate,
      income: payments.filter((p) => p.status === "CONFIRMED" && inWindow(p.paidAt, from, to)).reduce((s, p) => s + p.amount, 0),
      spend: expenses.filter((e) => inWindow(e.date, from, to)).reduce((s, e) => s + e.amount, 0),
      applications: applications.filter((a) => inWindow(a.submittedAt, from, to)).length,
      messages: messages.filter((m) => m.status === "SENT" && inWindow(m.sentAt, from, to)).length,
      events: events.filter((e) => inWindow(e.date, from, to)).length,
      registers: new Set(recs.map((r) => `${r.date}|${r.className}|${r.arm}`)).size,
    };
  };
  const thisWeek = weekStats(thisMonday, addDays(thisMonday, 7));
  const lastWeek = weekStats(lastMonday, thisMonday);

  /* departments */
  const academicDepartments = [
    { name: "Early Years", icon: HeartHandshake, tone: "bg-upwa-orange-50 text-upwa-orange-800", match: (c: string) => ["Crèche", "Pre-Nursery", "Nursery 1", "Nursery 2"].includes(c) },
    { name: "Primary", icon: School, tone: "bg-upwa-blue-50 text-upwa-blue-800", match: (c: string) => c.startsWith("Primary") },
    { name: "Junior Secondary", icon: School, tone: "bg-upwa-green-50 text-upwa-green-800", match: (c: string) => c.startsWith("JSS") },
    { name: "Senior Secondary", icon: School, tone: "bg-violet-50 text-violet-800", match: (c: string) => c.startsWith("SSS") },
  ].map((department) => {
    const roll = students.filter((student) => student.status === "ACTIVE" && department.match(student.className));
    const ids = new Set(roll.map((student) => student.id));
    const recs = register.filter((record) => ids.has(record.studentId));
    const rate = recs.length ? Math.round((recs.filter((record) => record.status !== "ABSENT").length / recs.length) * 100) : 0;
    const theirInvoices = invoices.filter((invoice) => ids.has(invoice.studentId));
    const theirBilled = theirInvoices.reduce((sum, invoice) => sum + invoiceTotal(invoice), 0);
    const theirPaid = theirInvoices.reduce((sum, invoice) => sum + confirmedPayments(payments, invoice.id), 0);
    const theirRate = theirBilled ? Math.round((theirPaid / theirBilled) * 100) : 0;
    return { ...department, roll: roll.length, rate, feesRate: theirRate, outstanding: theirBilled - theirPaid };
  });

  const offices = [
    {
      name: "Bursary",
      icon: Wallet,
      tone: "bg-upwa-green-50 text-upwa-green-800",
      headline: `${naira(paidToday.reduce((s, p) => s + p.amount, 0))} banked today`,
      detail: `${pending.length} transfer(s) awaiting confirmation · ${overdue.length} families overdue`,
    },
    {
      name: "Admissions Office",
      icon: Inbox,
      tone: "bg-upwa-blue-50 text-upwa-blue-800",
      headline: `${applications.filter((a) => ["SUBMITTED", "UNDER_REVIEW", "EXAM_SCHEDULED"].includes(a.status)).length} live applications`,
      detail: `${applications.filter((a) => a.status === "OFFER_MADE").length} offer(s) awaiting parents · ${thisWeek.applications} new this week`,
    },
    {
      name: "ICT & Platform",
      icon: Cpu,
      tone: "bg-upwa-canvas text-upwa-blue-800",
      headline: `${messages.filter((m) => m.status === "SENT").length} broadcasts sent this term`,
      detail: `${messages.filter((m) => m.status === "SENT").reduce((s, m) => s + m.recipients, 0)} parent touches · portal & Paystack live`,
    },
    {
      name: "Student Welfare",
      icon: Activity,
      tone: "bg-rose-50 text-rose-700",
      headline: `${absent} absence(s) in today's register`,
      detail: `${excused} excused · parents of unexcused absences auto-notified by SMS`,
    },
  ];

  /* attention list */
  const attention: { tone: "red" | "orange" | "blue"; text: string }[] = [];
  if (overdue.length) attention.push({ tone: "red", text: `${overdue.length} families are past their fee date, owing ${naira(overdueValue)}. The bursary is on installment plans where agreed.` });
  if (pending.length) attention.push({ tone: "orange", text: `${pending.length} bank transfer(s) totalling ${naira(pending.reduce((s, p) => s + p.amount, 0))} await Mrs. Ameh's confirmation.` });
  if (absent > 0) attention.push({ tone: "orange", text: `${absent} pupil(s) absent without excuse today; parents were notified at close of the register.` });
  if (instalmentDue.length) attention.push({ tone: "blue", text: `${instalmentDue.length} installment balances (${naira(instalmentValue)}) fall due on ${formatDate(settings.termEndDate)} — the last day of term.` });
  const onLeave = staff.filter((member) => member.status === "ON_LEAVE");
  if (onLeave.length) attention.push({ tone: "blue", text: `${onLeave.map((m) => `${m.title} ${m.firstName} ${m.lastName}`).join(", ")} on approved leave; classes are covered.` });
  if (!attention.length) attention.push({ tone: "blue", text: "Nothing needs your attention today. A quiet day is a good day." });

  /* delivery log: daily at 4 PM on workdays, weekly Fridays 6 PM */
  const log: { kind: "daily" | "weekly"; at: string; state: "delivered" | "scheduled" }[] = [];
  for (let cursor = addDays(thisMonday, -7); cursor <= now; cursor = addDays(cursor, 1)) {
    const day = cursor.getDay();
    if (day === 5) {
      const at = addDays(cursor, 0);
      at.setHours(18, 0, 0, 0);
      log.push({ kind: "weekly", at: at.toISOString(), state: at <= now ? "delivered" : "scheduled" });
    } else if (day >= 1 && day <= 4) {
      const at = new Date(cursor);
      at.setHours(16, 0, 0, 0);
      log.push({ kind: "daily", at: at.toISOString(), state: at <= now ? "delivered" : "scheduled" });
    }
  }
  const todayClose = new Date(now);
  todayClose.setHours(16, 0, 0, 0);
  if (now.getDay() >= 1 && now.getDay() <= 5) log.push({ kind: "daily", at: todayClose.toISOString(), state: todayClose <= now ? "delivered" : "scheduled" });

  const marksOnFile = scores.length;
  const nextFriday = addDays(thisMonday, 4);
  const lastFriday = addDays(thisMonday, -3);

  return {
    now, today, registerIsToday, latestRegister,
    present, late, absent, excused, attendanceRate, termAttendance, registerCount: register.length,
    paidToday, pending, spentToday,
    billed, collected, spent, cash, collectionRate, spendRate,
    overdue, overdueValue, instalmentDue, instalmentValue,
    weeklyChart, byCategory, thisWeek, lastWeek, thisMonday, lastFriday, nextFriday,
    academicDepartments, offices, attention, log,
    marksOnFile, subjects: subjects.length, staff, settings, students, events, messages,
    roll: students.filter((s) => s.status === "ACTIVE").length,
  };
}

export type PresidentBrief = ReturnType<typeof computePresidentBrief>;
