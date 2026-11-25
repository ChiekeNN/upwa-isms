/**
 * Demo portal domain types.
 *
 * This module models the same entities the production schema uses (students,
 * guardians, staff, subjects, attendance, scores, invoices, payments,
 * admissions, events and messages) so the demonstration behaves like the real
 * product. All records are synthetic demonstration data and live only in the
 * browser — see `store.tsx`.
 */

export type Gender = "FEMALE" | "MALE";

export type DivisionCode = "PRIMARY_EARLY_YEARS" | "SECONDARY";

export type TermCode = "FIRST" | "SECOND" | "THIRD";

export type StudentStatus = "ACTIVE" | "GRADUATED" | "WITHDRAWN" | "SUSPENDED";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type PaymentMethod = "BANK_TRANSFER" | "PAYSTACK" | "CASH_BURSARY";

export type PaymentStatus = "CONFIRMED" | "PENDING_REVIEW" | "REJECTED";

export type InvoiceStatus = "PAID" | "PART_PAYMENT" | "OUTSTANDING" | "OVERDUE";

export type ApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "EXAM_SCHEDULED"
  | "OFFER_MADE"
  | "ENROLLED"
  | "WAITLISTED"
  | "DECLINED";

export type EventType = "ACADEMIC" | "EXAMINATION" | "CEREMONY" | "HOLIDAY" | "MEETING" | "SPORTS" | "PTA";

export type MessageChannel = "SMS" | "EMAIL" | "SMS_AND_EMAIL";

export type MessageStatus = "DRAFT" | "SCHEDULED" | "SENT";

/** Classes ordered by progression so sorting and "next class" logic are stable. */
export const CLASS_ORDER = [
  "Crèche",
  "Pre-Nursery",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
] as const;

export type SchoolClass = (typeof CLASS_ORDER)[number];

export const CLASS_ARMS = ["A", "B", "C"] as const;
export type ClassArm = (typeof CLASS_ARMS)[number];

export const HOUSES = ["Delta House", "Niger House", "Bonny House", "Soku House"] as const;
export type House = (typeof HOUSES)[number];

export function divisionOfClass(className: SchoolClass): DivisionCode {
  return CLASS_ORDER.indexOf(className) < CLASS_ORDER.indexOf("JSS 1")
    ? "PRIMARY_EARLY_YEARS"
    : "SECONDARY";
}

export type Guardian = {
  id: string;
  title: string;
  fullName: string;
  relationship: "Mother" | "Father" | "Guardian" | "Aunt" | "Uncle";
  phone: string;
  email: string;
  occupation: string;
  address: string;
};

export type Student = {
  id: string;
  admissionNumber: string;
  firstName: string;
  otherName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: string;
  className: SchoolClass;
  arm: ClassArm;
  house: House;
  guardianId: string;
  address: string;
  stateOfOrigin: string;
  admissionDate: string;
  status: StudentStatus;
  medicalNote: string;
};

export type StaffRole =
  | "Head Teacher"
  | "Principal"
  | "Vice Principal"
  | "Class Teacher"
  | "Subject Teacher"
  | "Bursar"
  | "Administrator"
  | "Counsellor"
  | "ICT Officer";

export type Staff = {
  id: string;
  staffNumber: string;
  title: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  role: StaffRole;
  subject: string;
  assignedClass: string;
  phone: string;
  email: string;
  employmentDate: string;
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED";
};

export type SubjectLevel = "EARLY_YEARS" | "LOWER_PRIMARY" | "UPPER_PRIMARY" | "JUNIOR_SECONDARY" | "SENIOR_SECONDARY";

export type Subject = {
  id: string;
  code: string;
  name: string;
  level: SubjectLevel;
  classes: SchoolClass[];
  teacherId: string;
};

export type AttendanceRecord = {
  id: string;
  studentId: string;
  className: SchoolClass;
  arm: ClassArm;
  date: string;
  status: AttendanceStatus;
  note: string;
  recordedBy: string;
};

export type Score = {
  id: string;
  studentId: string;
  subjectId: string;
  className: SchoolClass;
  arm: ClassArm;
  session: string;
  term: TermCode;
  ca1: number;
  ca2: number;
  exam: number;
};

export type InvoiceItem = {
  label: string;
  amount: number;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  session: string;
  term: TermCode;
  items: InvoiceItem[];
  dueDate: string;
};

export type Payment = {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  bank: string;
  status: PaymentStatus;
  paidAt: string;
  recordedBy: string;
};

export type AdmissionApplication = {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  applyingFor: SchoolClass;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  previousSchool: string;
  status: ApplicationStatus;
  submittedAt: string;
  examDate: string;
  examVenue: string;
  note: string;
};

export type SchoolEvent = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  type: EventType;
  audience: string;
  venue: string;
  description: string;
};

export type Message = {
  id: string;
  subject: string;
  body: string;
  channel: MessageChannel;
  audience: string;
  status: MessageStatus;
  recipients: number;
  sentAt: string;
};

export type GradeBand = {
  min: number;
  grade: string;
  remark: string;
};

export type FeeStructureRow = {
  id: string;
  level: string;
  tuition: number;
  levies: number;
  feeding: number;
};

export type DemoSettings = {
  schoolName: string;
  session: string;
  currentTerm: TermCode;
  termStartDate: string;
  termEndDate: string;
  nextTermBegins: string;
  grading: GradeBand[];
  caMax: number;
  examMax: number;
  fees: FeeStructureRow[];
  attendanceTarget: number;
  /** Where the President's daily and weekly PDF briefs are delivered. */
  presidentEmail: string;
  /** Money in the school account on the first day of term. */
  openingBalance: number;
};

export type ExpenseCategory =
  | "Salaries & wages"
  | "Feeding & kitchen"
  | "Utilities"
  | "Maintenance & facilities"
  | "Learning materials"
  | "ICT & platform"
  | "Transport & trips"
  | "Events & welfare"
  | "Security & cleaning"
  | "Medical & safety";

export type Expense = {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  department: string;
  paidTo: string;
  amount: number;
  method: PaymentMethod;
  approvedBy: string;
};

export type DemoData = {
  students: Student[];
  guardians: Guardian[];
  staff: Staff[];
  subjects: Subject[];
  attendance: AttendanceRecord[];
  scores: Score[];
  invoices: Invoice[];
  payments: Payment[];
  applications: AdmissionApplication[];
  events: SchoolEvent[];
  messages: Message[];
  expenses: Expense[];
  settings: DemoSettings;
};

/** Keys of `DemoData` whose value is an array of identifiable records. */
export type CollectionKey = {
  [K in keyof DemoData]: DemoData[K] extends { id: string }[] ? K : never;
}[keyof DemoData];

export type EntityOf<K extends CollectionKey> = DemoData[K][number];
