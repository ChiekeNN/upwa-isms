import type {
  Attestation,
  AuditEntry,
  BankCredit,
  CategoryBudget,
  Concern,
  DemoSettings,
  Expense,
  ExpenseApproval,
  Guardian,
  ParentConfirmation,
  Payment,
  ReceiptBook,
  Staff,
  Student,
} from "./types";

/**
 * The demonstration records behind the President's integrity controls.
 *
 * Built by derivation and explicit narrative rather than the shared PRNG, so
 * the rest of the demo dataset stays byte-identical and this file reads as the
 * story it tells: money that arrived and was never written down, a purchase
 * split to dodge an approval limit, a receipt book with pages missing.
 *
 * Every record here is fictional. The scenarios are the ones private schools in
 * Nigeria actually lose money to, chosen so each control on the President's
 * dashboard has something true to detect.
 */

const BURSAR = "Mrs. Grace Ameh (Bursar)";
const BURSARY_OFFICER = "Mr. Emmanuel Bassey (Bursary Officer)";
const HEAD_TEACHER = "Mrs. Ndidi Okeke (Head Teacher)";
const PRINCIPAL = "Mr. Anthony Wokoma (Principal)";
const PRESIDENT = "Dr. Chinwe Chike (President)";
const FACILITY_OFFICER = "Mr. Sunday Alagoa (Facility Officer)";

const day = (value: Date) => value.toISOString().slice(0, 10);
const shift = (today: Date, days: number) => {
  const copy = new Date(today);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const stamp = (today: Date, days: number, hours: number, minutes = 0) => {
  const copy = shift(today, days);
  copy.setHours(hours, minutes, 0, 0);
  return copy.toISOString().slice(0, 19);
};
const nairaK = (value: number) => value.toLocaleString("en-NG");

export type IntegrityRecords = {
  bankCredits: BankCredit[];
  parentConfirmations: ParentConfirmation[];
  expenseApprovals: ExpenseApproval[];
  attestations: Attestation[];
  auditLog: AuditEntry[];
  concerns: Concern[];
  budgets: CategoryBudget[];
  receiptBooks: ReceiptBook[];
  presidentActions: never[];
};

export function buildIntegrityRecords(input: {
  students: Student[];
  guardians: Guardian[];
  payments: Payment[];
  expenses: Expense[];
  staff: Staff[];
  settings: DemoSettings;
  today: Date;
}): IntegrityRecords {
  const { students, guardians, payments, expenses, settings, today } = input;
  const guardianOf = (studentId: string) => {
    const student = students.find((item) => item.id === studentId);
    return guardians.find((item) => item.id === student?.guardianId);
  };

  /* ------------------------- the bank's own feed ------------------------- */

  const confirmedNonCash = payments.filter((payment) => payment.status === "CONFIRMED" && payment.method !== "CASH_BURSARY");
  const bankCredits: BankCredit[] = confirmedNonCash.map((payment, index) => ({
    id: `bnk-${String(index + 1).padStart(4, "0")}`,
    date: payment.paidAt,
    amount: payment.amount,
    channel: payment.method,
    payerName: guardianOf(payment.studentId)?.fullName ?? "Family",
    reference: payment.reference,
    bank: payment.bank,
    matchedPaymentId: payment.id,
    matchedReceiptNumber: payment.receiptNumber,
    status: "MATCHED",
    studentId: payment.studentId,
    note: `Matched to receipt ${payment.receiptNumber}`,
  }));

  // Cash taken at the bursary is banked, so the feed carries it as a deposit.
  // Without these the bank column would only ever show transfers, and the
  // three-way match would be meaningless.
  const cashByDay = new Map<string, Payment[]>();
  payments
    .filter((payment) => payment.status === "CONFIRMED" && payment.method === "CASH_BURSARY")
    .forEach((payment) => cashByDay.set(payment.paidAt, [...(cashByDay.get(payment.paidAt) ?? []), payment]));
  [...cashByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, dayPayments], index) => {
    const total = dayPayments.reduce((sum, payment) => sum + payment.amount, 0);
    bankCredits.push({
      id: `bnk-cash-${String(index + 1).padStart(3, "0")}`,
      date,
      amount: total,
      channel: "CASH_DEPOSIT",
      payerName: "Bursary cash deposit",
      reference: `DEP/${date.replaceAll("-", "").slice(2)}`,
      bank: "First Bank",
      matchedPaymentId: dayPayments[0].id,
      matchedReceiptNumber: dayPayments[0].receiptNumber,
      status: "MATCHED",
      studentId: null,
      note: `Cash banked the same day, covering ${dayPayments.length} receipt${dayPayments.length === 1 ? "" : "s"}`,
    });
  });

  const nextBankId = bankCredits.length + 1;
  const incidentPupil = students[7] ?? students[0];
  const incidentParent = guardianOf(incidentPupil.id);

  // The incident: money the bank received, a receipt the parent holds, and
  // nothing at all in the bursary's ledger.
  bankCredits.push({
    id: `bnk-${String(nextBankId).padStart(4, "0")}`,
    date: day(shift(today, -2)),
    amount: 185_000,
    channel: "BANK_TRANSFER",
    payerName: incidentParent?.fullName ?? "Mrs. Ifeoma Nwankwo",
    reference: "TRF/88213/UPWA",
    bank: "Zenith Bank",
    matchedPaymentId: null,
    matchedReceiptNumber: null,
    status: "UNMATCHED",
    studentId: incidentPupil.id,
    note: "No receipt was ever issued for this credit",
  });
  bankCredits.push({
    id: `bnk-${String(nextBankId + 1).padStart(4, "0")}`,
    date: day(shift(today, -1)),
    amount: 25_000,
    channel: "POS",
    payerName: "POS settlement — gate kiosk",
    reference: "POS/SETTLE/4471",
    bank: "First Bank",
    matchedPaymentId: null,
    matchedReceiptNumber: null,
    status: "UNMATCHED",
    studentId: null,
    note: "Settled to the school's account with no receipt behind it",
  });
  bankCredits.push({
    id: `bnk-${String(nextBankId + 2).padStart(4, "0")}`,
    date: day(shift(today, -4)),
    amount: 40_000,
    channel: "BANK_TRANSFER",
    payerName: (guardianOf((students[19] ?? students[1]).id)?.fullName) ?? "Family",
    reference: "TRF/77120/UPWA",
    bank: "GTBank",
    matchedPaymentId: null,
    matchedReceiptNumber: null,
    status: "PART_MATCHED",
    studentId: (students[19] ?? students[1]).id,
    note: "₦40,000 arrived; the ledger shows a ₦25,000 receipt for this family",
  });

  /* ------------------- receipts the platform sent parents ------------------- */

  const parentConfirmations: ParentConfirmation[] = payments
    .filter((payment) => payment.status === "CONFIRMED")
    .map((payment, index) => ({
      id: `pcf-${String(index + 1).padStart(4, "0")}`,
      receiptReference: payment.receiptNumber,
      studentId: payment.studentId,
      parentName: guardianOf(payment.studentId)?.fullName ?? "Family",
      guardianPhone: guardianOf(payment.studentId)?.phone ?? "—",
      amount: payment.amount,
      method: payment.method,
      paidOn: payment.paidAt,
      channel: (["SMS", "WHATSAPP", "EMAIL"] as const)[index % 3],
      sentAt: `${payment.paidAt}T09:12:00`,
      delivered: true,
      acknowledgedAt: index % 4 === 0 ? `${payment.paidAt}T18:40:00` : null,
      ledgerPaymentId: payment.id,
      status: "MATCHED",
    }));

  const nextParentId = parentConfirmations.length + 1;
  parentConfirmations.push({
    id: `pcf-${String(nextParentId).padStart(4, "0")}`,
    receiptReference: `RCP/${settings.session.replace("/", "-")}/AUTO-${nextParentId}`,
    studentId: incidentPupil.id,
    parentName: incidentParent?.fullName ?? "Mrs. Ifeoma Nwankwo",
    guardianPhone: incidentParent?.phone ?? "—",
    amount: 185_000,
    method: "BANK_TRANSFER",
    paidOn: day(shift(today, -2)),
    channel: "SMS",
    sentAt: stamp(today, -2, 11, 24),
    delivered: true,
    acknowledgedAt: stamp(today, -2, 19, 5),
    ledgerPaymentId: null,
    status: "NOT_IN_LEDGER",
  });
  parentConfirmations.push({
    id: `pcf-${String(nextParentId + 1).padStart(4, "0")}`,
    receiptReference: `RCP/${settings.session.replace("/", "-")}/AUTO-${nextParentId + 1}`,
    studentId: (students[24] ?? students[2]).id,
    parentName: guardianOf((students[24] ?? students[2]).id)?.fullName ?? "Mr. Udeme Ekong",
    guardianPhone: guardianOf((students[24] ?? students[2]).id)?.phone ?? "—",
    amount: 60_000,
    method: "CASH_BURSARY",
    paidOn: day(shift(today, -6)),
    channel: "WHATSAPP",
    sentAt: stamp(today, -6, 13, 41),
    delivered: true,
    acknowledgedAt: stamp(today, -6, 20, 12),
    ledgerPaymentId: null,
    status: "NOT_IN_LEDGER",
  });

  /* ------------------------------ receipt books ----------------------------- */

  const numbers = payments.map((payment) => Number(payment.receiptNumber.split("/").pop())).filter((value) => Number.isFinite(value));
  const first = Math.min(...numbers, 421);
  const last = Math.max(...numbers, 460);
  const receiptBooks: ReceiptBook[] = [
    {
      id: "rcb-0001",
      label: "Bursary counter book A",
      heldBy: BURSAR,
      firstNumber: first,
      lastNumber: last + 6,
      used: [...new Set(numbers)].sort((a, b) => a - b),
      voided: [
        { number: last + 2, reason: "Spoilt in the printer, never issued", approvedBy: HEAD_TEACHER },
        { number: last + 5, reason: "", approvedBy: null },
      ],
    },
    {
      id: "rcb-0002",
      label: "Cash book — gate collections",
      heldBy: BURSARY_OFFICER,
      firstNumber: 900,
      lastNumber: 940,
      used: Array.from({ length: 38 }, (_, index) => 900 + index).filter((value) => ![913, 914, 928].includes(value)),
      voided: [],
    },
  ];

  /* ---------------------------- expense approvals --------------------------- */

  /** Who raises a request. Deliberately not the person who approves it: an
   *  approval is only an approval when it comes from somebody else. */
  const REQUESTER_BY_CATEGORY: Record<Expense["category"], string> = {
    "Salaries & wages": PRINCIPAL,
    "Feeding & kitchen": "Mrs. Ngozi Eze (Kitchen Supervisor)",
    Utilities: FACILITY_OFFICER,
    "Maintenance & facilities": FACILITY_OFFICER,
    "Learning materials": HEAD_TEACHER,
    "ICT & platform": "Mr. Joseph Etim (ICT Officer)",
    "Transport & trips": "Mr. Patrick Umeh (Transport Officer)",
    "Events & welfare": HEAD_TEACHER,
    "Security & cleaning": FACILITY_OFFICER,
    "Medical & safety": "Mrs. Adaeze Nwosu (School Nurse)",
  };
  const requesterFor = (expense: Expense) =>
    expense.department === "Bursary" ? BURSAR : REQUESTER_BY_CATEGORY[expense.category] ?? BURSAR;

  const expenseApprovals: ExpenseApproval[] = expenses.map((expense, index) => ({
    id: `apr-${String(index + 1).padStart(4, "0")}`,
    expenseId: expense.id,
    date: expense.date,
    description: expense.description,
    vendor: expense.paidTo,
    category: expense.category,
    amount: expense.amount,
    requestedBy: requesterFor(expense),
    approvedBy: expense.approvedBy,
    status: expense.approvedBy.startsWith("Not approved") ? "PAID_WITHOUT_APPROVAL" : "APPROVED",
    evidence: index % 5 !== 0,
    evidenceNote: index % 5 !== 0 ? "Invoice filed in the bursary" : "Paid on a verbal instruction; nothing filed",
    paidAt: expense.date,
    invoiceRef: index % 3 === 0 ? `INV/${settings.session.replace("/", "-")}/${String(index + 101).padStart(4, "0")}` : null,
  }));

  const nextApprovalId = expenseApprovals.length + 1;
  const planted = (approval: Omit<ExpenseApproval, "id">, offset = 0): ExpenseApproval => ({
    ...approval,
    id: `apr-${String(nextApprovalId + offset).padStart(4, "0")}`,
  });

  // Two requests that cannot be paid until the President decides.
  expenseApprovals.push(
    planted({
      expenseId: null,
      date: day(shift(today, -1)),
      description: "Repairs to the leaking roof over the Primary 4 – 6 block",
      vendor: "Choba hardware & supplies",
      category: "Maintenance & facilities",
      amount: 650_000,
      requestedBy: PRINCIPAL,
      approvedBy: null,
      status: "PENDING",
      evidence: true,
      evidenceNote: "Two quotes attached, as policy requires above ₦500,000",
      paidAt: null,
      invoiceRef: null,
    }),
    planted(
      {
        expenseId: null,
        date: day(today),
        description: "Replacement battery bank for the standby generator",
        vendor: "Powerline electrical services",
        category: "Utilities",
        amount: 240_000,
        requestedBy: FACILITY_OFFICER,
        approvedBy: null,
        status: "PENDING",
        evidence: false,
        evidenceNote: "No quote attached yet",
        paidAt: null,
        invoiceRef: null,
      },
      1,
    ),
  );

  /* ------------------------------- attestations ------------------------------ */

  const attestations: Attestation[] = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = day(shift(today, -index));
    const cashOfDay = payments
      .filter((payment) => payment.paidAt === date && payment.method === "CASH_BURSARY" && payment.status === "CONFIRMED")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const bankOfDay = payments
      .filter((payment) => payment.paidAt === date && payment.method !== "CASH_BURSARY" && payment.status === "CONFIRMED")
      .reduce((sum, payment) => sum + payment.amount, 0);

    if (index === 0) {
      attestations.push({
        id: `atst-${date}-bursar`,
        date,
        role: "BURSAR",
        signedBy: BURSAR,
        status: "OVERDUE",
        signedAt: null,
        cashDeclared: 0,
        bankDeclared: 0,
        ledgerTotal: cashOfDay + bankOfDay,
        variance: 0,
        note: "Not signed. The bursary closed at 4:20 PM without a declaration.",
      });
    } else if (index === 1) {
      attestations.push({
        id: `atst-${date}-bursar`,
        date,
        role: "BURSAR",
        signedBy: BURSAR,
        status: "VARIANCE",
        signedAt: `${date}T17:26:00`,
        cashDeclared: Math.max(0, cashOfDay - 35_000),
        bankDeclared: bankOfDay,
        ledgerTotal: cashOfDay + bankOfDay,
        variance: 35_000,
        note: "Cash counted was ₦35,000 less than the ledger shows taken that day.",
      });
    } else {
      attestations.push({
        id: `atst-${date}-bursar`,
        date,
        role: "BURSAR",
        signedBy: BURSAR,
        status: "SIGNED",
        signedAt: `${date}T17:0${index % 5}:00`,
        cashDeclared: cashOfDay,
        bankDeclared: bankOfDay,
        ledgerTotal: cashOfDay + bankOfDay,
        variance: 0,
        note: "Cash and bank agreed with the ledger.",
      });
    }
    attestations.push({
      id: `atst-${date}-head`,
      date,
      role: "HEAD_TEACHER",
      signedBy: HEAD_TEACHER,
      status: index === 0 ? "OVERDUE" : "SIGNED",
      signedAt: index === 0 ? null : `${date}T16:4${index % 6}:00`,
      cashDeclared: 0,
      bankDeclared: 0,
      ledgerTotal: cashOfDay + bankOfDay,
      variance: 0,
      note: index === 0 ? "Countersignature outstanding." : "Countersigned after checking the day's registers.",
    });
  }

  /* -------------------------------- audit log -------------------------------- */

  const auditLog: AuditEntry[] = [
    {
      id: "aud-0001",
      at: stamp(today, -2, 21, 40),
      actor: BURSAR,
      action: "Payment backdated by 11 days",
      targetType: "payment",
      targetId: "pay-0009",
      detail: `A ₦95,000 receipt was re-dated from ${formatWhen(shift(today, -2))} to ${formatWhen(shift(today, -13))}, moving it into a period already reported to you.`,
      severity: "ALERT",
      amount: 95_000,
    },
    {
      id: "aud-0002",
      at: stamp(today, -3, 15, 12),
      actor: BURSAR,
      action: "Receipt voided without a reason recorded",
      targetType: "receipt book",
      targetId: "rcb-0001",
      detail: `Receipt number ${last + 5} in Bursary counter book A was cancelled with no reason and no countersignature.`,
      severity: "ALERT",
      amount: 60_000,
    },
    {
      id: "aud-0003",
      at: stamp(today, -5, 11, 5),
      actor: BURSAR,
      action: "Vendor bank account changed",
      targetType: "vendor",
      targetId: "Choba hardware & supplies",
      detail: "The account paid for Choba hardware & supplies was changed to a new bank and a personal account name, four days before a ₦255,000 payment run.",
      severity: "ALERT",
      amount: null,
    },
    {
      id: "aud-0004",
      at: stamp(today, -6, 13, 55),
      actor: BURSARY_OFFICER,
      action: "Fee waiver granted without an approver",
      targetType: "waiver",
      targetId: "inv-0031",
      detail: "₦125,000 was written off a family's balance with no approver recorded. Waivers remove income without any cash moving.",
      severity: "ALERT",
      amount: 125_000,
    },
    {
      id: "aud-0005",
      at: stamp(today, -8, 18, 22),
      actor: BURSAR,
      action: "Expense approval deleted after payment",
      targetType: "expense",
      targetId: "exp-0021",
      detail: "The approval record behind a ₦120,000 payment was removed after the money had left the account.",
      severity: "ALERT",
      amount: 120_000,
    },
    {
      id: "aud-0006",
      at: stamp(today, -4, 22, 15),
      actor: BURSARY_OFFICER,
      action: "Ledger entry created outside working hours",
      targetType: "payment",
      targetId: "pay-0027",
      detail: "A ₦25,000 cash receipt was written into the ledger at 10:15 PM on a weekday.",
      severity: "WATCH",
      amount: 25_000,
    },
    {
      id: "aud-0007",
      at: stamp(today, -9, 9, 30),
      actor: HEAD_TEACHER,
      action: "Staff bank details updated",
      targetType: "staff",
      targetId: "stf-0014",
      detail: "The account for a member of staff who resigned last month was changed after their final payroll run.",
      severity: "WATCH",
      amount: null,
    },
    {
      id: "aud-0008",
      at: stamp(today, -1, 16, 5),
      actor: BURSAR,
      action: "Daily declaration signed",
      targetType: "settings",
      targetId: `atst-${day(shift(today, -1))}-bursar`,
      detail: "The bursar signed the close-of-day declaration, reporting a ₦35,000 cash shortage.",
      severity: "INFO",
      amount: 35_000,
    },
    {
      id: "aud-0009",
      at: stamp(today, -1, 10, 2),
      actor: "UPWA-ISMS",
      action: "Bank feed reconciled automatically",
      targetType: "payment",
      targetId: "bnk-feed",
      detail: `${bankCredits.filter((credit) => credit.status === "MATCHED").length} bank credits were matched to ledger receipts without help from anybody.`,
      severity: "INFO",
      amount: null,
    },
    {
      id: "aud-0010",
      at: stamp(today, -2, 11, 24),
      actor: "UPWA-ISMS",
      action: "Parent receipt issued automatically",
      targetType: "payment",
      targetId: `pcf-${String(nextParentId).padStart(4, "0")}`,
      detail: `A ₦185,000 receipt was sent to ${incidentParent?.fullName ?? "a parent"} by SMS the moment the bank confirmed the transfer — no bursary staff involved.`,
      severity: "INFO",
      amount: 185_000,
    },
    {
      id: "aud-0011",
      at: stamp(today, -11, 12, 0),
      actor: PRINCIPAL,
      action: "Expense request raised",
      targetType: "expense",
      targetId: "apr-roof",
      detail: "A ₦650,000 roof repair request was raised with two quotes attached and sent to you for approval.",
      severity: "INFO",
      amount: 650_000,
    },
    {
      id: "aud-0012",
      at: stamp(today, -14, 8, 45),
      actor: PRESIDENT,
      action: "Term budgets approved",
      targetType: "settings",
      targetId: "budgets",
      detail: "Spending limits for the term were set and signed off by the President's Office.",
      severity: "INFO",
      amount: null,
    },
  ];

  /* --------------------------------- concerns -------------------------------- */

  const concerns: Concern[] = [
    {
      id: "con-0001",
      raisedAt: stamp(today, -3, 6, 15),
      channel: "CONFIDENTIAL_LINE",
      raisedBy: "Anonymous (staff)",
      anonymous: true,
      subject: "Cash taken at the gate on Friday never reached the ledger",
      body: "Two families paid cash at the gate kiosk on Friday afternoon. Receipts were written by hand from the gate book, but by Monday nothing had been entered into the system and the money was not in the safe.",
      aboutType: "receipt book",
      aboutId: "rcb-0002",
      amount: 45_000,
      status: "OPEN",
      response: null,
    },
    {
      id: "con-0002",
      raisedAt: stamp(today, -2, 14, 30),
      channel: "PARENT",
      raisedBy: incidentParent?.fullName ?? "Mrs. Ifeoma Nwankwo",
      anonymous: false,
      subject: "I paid by transfer and the school says there is no record",
      body: "I transferred ₦185,000 on Tuesday and received an SMS receipt from the school straight away. When I came to the bursary yesterday I was told my daughter still owes the full amount. I have the message on my phone.",
      aboutType: "payment",
      aboutId: `bnk-${String(nextBankId).padStart(4, "0")}`,
      amount: 185_000,
      status: "INVESTIGATING",
      response: null,
    },
    {
      id: "con-0003",
      raisedAt: stamp(today, -7, 17, 45),
      channel: "STAFF",
      raisedBy: "Mr. Emmanuel Bassey (Bursary Officer)",
      anonymous: false,
      subject: "I was asked to sign a declaration for a day I was not in school",
      body: "I was asked to sign last Wednesday's close-of-day declaration on the Thursday, for a day I was on leave. I signed it because I was told it was routine. I do not think it should be.",
      aboutType: "settings",
      aboutId: `atst-${day(shift(today, -6))}-bursar`,
      amount: null,
      status: "OPEN",
      response: null,
    },
  ];

  /* --------------------------------- budgets --------------------------------- */

  const spendByCategory = new Map<string, number>();
  expenses.forEach((expense) => spendByCategory.set(expense.category, (spendByCategory.get(expense.category) ?? 0) + expense.amount));
  const overBudget: string[] = ["Maintenance & facilities", "Feeding & kitchen"];
  const nearBudget = "Utilities";
  const budgets: CategoryBudget[] = [...spendByCategory.entries()].map(([category, spent], index) => {
    const allocated = overBudget.includes(category)
      ? Math.round((spent * 0.82) / 5000) * 5000
      : category === nearBudget
        ? Math.round((spent * 1.08) / 5000) * 5000
        : Math.round((spent * 1.55) / 5000) * 5000;
    return { id: `bud-${String(index + 1).padStart(4, "0")}`, category: category as CategoryBudget["category"], allocated, approvedBy: PRESIDENT };
  });

  void nairaK;

  return {
    bankCredits,
    parentConfirmations,
    expenseApprovals,
    attestations,
    auditLog,
    concerns,
    budgets,
    receiptBooks,
    presidentActions: [],
  };
}

function formatWhen(date: Date) {
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long" });
}
