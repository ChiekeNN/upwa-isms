import type {
  AttendanceRecord,
  DemoSettings,
  GradeBand,
  Invoice,
  InvoiceStatus,
  Payment,
  Score,
  Student,
} from "./types";

/** Shared presentation and calculation helpers for the demonstration portal. */

export function naira(amount: number) {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

export function compactNaira(amount: number) {
  if (Math.abs(amount) >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2)}m`;
  if (Math.abs(amount) >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
  return naira(amount);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(value: string, today = new Date()) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` === `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`
    ? "Today"
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLongDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${LONG_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function weekdayOf(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

export function relativeDay(value: string, today = new Date()) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - base.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

export function fullName(student: Pick<Student, "firstName" | "otherName" | "lastName">) {
  return [student.firstName, student.otherName, student.lastName].filter(Boolean).join(" ");
}

export function displayName(student: Pick<Student, "firstName" | "lastName">) {
  return `${student.lastName}, ${student.firstName}`;
}

export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic avatar colour so a pupil always looks the same across visits. */
export function avatarTone(seed: string) {
  const tones = [
    "bg-upwa-blue-100 text-upwa-blue-900",
    "bg-upwa-orange-100 text-upwa-orange-900",
    "bg-upwa-green-100 text-upwa-green-900",
    "bg-violet-100 text-violet-900",
    "bg-rose-100 text-rose-900",
    "bg-teal-100 text-teal-900",
    "bg-amber-100 text-amber-900",
    "bg-indigo-100 text-indigo-900",
  ];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return tones[hash % tones.length];
}

export function ageFromDob(dob: string, today = new Date()) {
  if (!dob) return "—";
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "—";
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return `${age} yrs`;
}

export function scoreTotal(score: Pick<Score, "ca1" | "ca2" | "exam">) {
  return (Number(score.ca1) || 0) + (Number(score.ca2) || 0) + (Number(score.exam) || 0);
}

export function gradeFor(total: number, grading: GradeBand[]): GradeBand {
  const sorted = [...grading].sort((a, b) => b.min - a.min);
  return sorted.find((band) => total >= band.min) ?? sorted[sorted.length - 1];
}

export function ordinal(position: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = position % 100;
  return `${position}${suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]}`;
}

/** Class position for a pupil across a set of subject totals, using total aggregate. */
export function classPositions(totals: { studentId: string; aggregate: number }[]) {
  const ranked = [...totals].sort((a, b) => b.aggregate - a.aggregate);
  const positions = new Map<string, number>();
  ranked.forEach((row, index) => {
    const previous = ranked[index - 1];
    const sameAsPrevious = previous && previous.aggregate === row.aggregate;
    positions.set(row.studentId, sameAsPrevious ? (positions.get(previous.studentId) ?? index + 1) : index + 1);
  });
  return positions;
}

export function invoiceTotal(invoice: Invoice) {
  return invoice.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Money the bursary has actually confirmed against an invoice. Transfers still
 * `PENDING_REVIEW` are deliberately excluded: they show in the review queue and
 * only affect the balance once they are confirmed.
 */
export function confirmedPayments(payments: Payment[], invoiceId: string) {
  return payments
    .filter((payment) => payment.invoiceId === invoiceId && payment.status === "CONFIRMED")
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
}

export function invoiceStatus(invoice: Invoice, payments: Payment[], today = new Date()): InvoiceStatus {
  const total = invoiceTotal(invoice);
  const paid = confirmedPayments(payments, invoice.id);
  if (paid >= total) return "PAID";
  if (paid > 0) return new Date(`${invoice.dueDate}T00:00:00`) < today ? "OVERDUE" : "PART_PAYMENT";
  return new Date(`${invoice.dueDate}T00:00:00`) < today ? "OVERDUE" : "OUTSTANDING";
}

export function attendanceSummary(records: AttendanceRecord[]) {
  const present = records.filter((record) => record.status === "PRESENT").length;
  const late = records.filter((record) => record.status === "LATE").length;
  const absent = records.filter((record) => record.status === "ABSENT").length;
  const excused = records.filter((record) => record.status === "EXCUSED").length;
  const total = records.length || 1;
  return {
    present,
    late,
    absent,
    excused,
    total: records.length,
    rate: Math.round(((present + late) / total) * 1000) / 10,
  };
}

export function termLabel(term: string) {
  return term === "FIRST" ? "First Term" : term === "SECOND" ? "Second Term" : "Third Term";
}

export function methodLabel(method: string) {
  if (method === "BANK_TRANSFER") return "Bank transfer";
  if (method === "PAYSTACK") return "Paystack (card / transfer)";
  return "Cash at bursary";
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function settingsSnapshot(settings: DemoSettings) {
  return `${settings.session} · ${termLabel(settings.currentTerm)}`;
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
