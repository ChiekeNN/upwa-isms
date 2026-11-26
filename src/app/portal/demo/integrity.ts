import { formatDate, naira } from "./format";
import { addDays, iso } from "./president-brief";
import type { DemoData, ExpenseApproval, PresidentAction } from "./types";

/**
 * The President's money controls.
 *
 * Everything here answers one question: could somebody take money, or spend it,
 * without Dr. Chike hearing about it? The rule that makes the answer "no" is
 * that income is never judged from the bursary's ledger alone. Every naira is
 * checked against evidence the bursary cannot rewrite — the bank's own feed, the
 * receipt the platform sent the parent automatically, and the sequential numbers
 * in the receipt book.
 *
 * Two habits keep this useful rather than noisy:
 *   - a control that passes is reported too, so she can see what is holding;
 *   - expected repetition is not treated as a duplicate. A market run every
 *     Monday is a standing commitment; a monthly contract paid twice in two days
 *     is not.
 */

export const CONTROL_POLICY = {
  /** Above this the President's approval is required before payment. */
  bursarApprovalCeiling: 100_000,
  /** Above this only the President may approve, and two quotes are needed. */
  presidentApprovalFloor: 500_000,
  /** Cash above this must be banked the same day, never held overnight. */
  cashCeiling: 50_000,
  /** Window in which separate payments to one vendor read as a single purchase. */
  splitWindowDays: 7,
  /** Two payments this close together, against a longer usual gap, read as a duplicate. */
  duplicateWindowDays: 10,
  /** Transfers awaiting confirmation become a finding after this many days. */
  pendingReviewDays: 3,
  /** A critical matter escalates to the executive board after this many hours. */
  escalationHours: 24,
  /** Share of a day's income taken in cash that warrants a question. */
  cashShareCeiling: 0.4,
};

export type Severity = "CRITICAL" | "HIGH" | "WATCH" | "CLEAN";
export type FindingGroup = "Money in" | "Money out" | "Payroll" | "Governance";

/** The standing register of controls. Each is tested every time the report runs. */
export const CONTROLS: { id: string; label: string; group: FindingGroup }[] = [
  { id: "bank-reconciliation", label: "Every naira the bank received has a receipt behind it", group: "Money in" },
  { id: "parent-receipt", label: "Every parent holds a receipt the bursary did not have to issue", group: "Money in" },
  { id: "receipt-continuity", label: "Receipt books are complete, sequential and accounted for", group: "Money in" },
  { id: "cash-declaration", label: "Cash counted at close of day agrees with the ledger", group: "Money in" },
  { id: "confirmation-sla", label: "Transfers are confirmed or refused within three days", group: "Money in" },
  { id: "cash-banking", label: "Cash above the limit reaches the bank the same day", group: "Money in" },
  { id: "bank-feed-currency", label: "The bank feed arrives on every working day", group: "Money in" },
  { id: "expense-authorisation", label: "Nothing is paid without the approval the policy requires", group: "Money out" },
  { id: "purchase-integrity", label: "Purchases are not split to stay under an approval limit", group: "Money out" },
  { id: "duplicate-payment", label: "No vendor is paid twice for one delivery", group: "Money out" },
  { id: "supporting-documents", label: "Payments have an invoice, quote or receipt on file", group: "Money out" },
  { id: "self-approval", label: "Nobody approves a request they made themselves", group: "Money out" },
  { id: "approval-queue", label: "Requests above the limit reach the President before payment", group: "Money out" },
  { id: "budget-discipline", label: "Spending stays inside the budget approved for the term", group: "Money out" },
  { id: "payroll-integrity", label: "Only people who work here are on the payroll", group: "Payroll" },
  { id: "payroll-movement", label: "Payroll moves only for a stated, approved reason", group: "Payroll" },
  { id: "daily-attestation", label: "Each day's money is declared and signed for by name", group: "Governance" },
  { id: "segregation-of-duties", label: "No single person controls the whole money trail", group: "Governance" },
  { id: "record-integrity", label: "Records are not altered, backdated or removed after the fact", group: "Governance" },
  { id: "working-hours", label: "Changes to the money records happen in working hours", group: "Governance" },
  { id: "concern-response", label: "Every concern raised is answered and closed in writing", group: "Governance" },
  { id: "escalation", label: "Critical matters are closed or escalated within 24 hours", group: "Governance" },
];

export type Finding = {
  id: string;
  code: string;
  control: string;
  severity: Severity;
  group: FindingGroup;
  title: string;
  /** What happened, in the words she would use herself. */
  plainWords: string;
  /** Why it matters — the risk, in one sentence. */
  whatItMeans: string;
  amount: number | null;
  who: string;
  /** Human date, for display. */
  when: string;
  /** ISO date, for ageing and escalation. */
  since: string;
  evidence: { label: string; value: string }[];
  action: string;
  /** True once she has closed it from her own office; closed findings stop counting. */
  resolved: boolean;
  /** True when the finding is the control working (a queue waiting on her), not failing. */
  informational?: boolean;
  allows: PresidentAction["kind"][];
  targetType: string;
  targetId: string;
};

export type IntegritySummary = {
  findings: Finding[];
  counts: Record<Severity, number>;
  /** Money the school cannot presently account for. */
  exposure: number;
  hiddenIncome: number;
  unapprovedSpend: number;
  /** Controls holding today, out of the register. */
  controlsHeld: number;
  controlsFailed: number;
  controlsTotal: number;
  /** Findings she has already closed. */
  resolvedCount: number;
  /** 0–100: the share of the control register that is holding. */
  assurance: number;
  register: { control: (typeof CONTROLS)[number]; status: Severity | "FAILED"; findings: Finding[] }[];
  openConcerns: number;
  awaitingHer: number;
};

export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "WATCH", "CLEAN"];

const money = (value: number) => naira(value);
const dayKey = (value: string) => value.slice(0, 10);

function withinDays(a: string, b: string, days: number) {
  return Math.abs(new Date(`${dayKey(a)}T00:00:00`).getTime() - new Date(`${dayKey(b)}T00:00:00`).getTime()) <= days * 86400000;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Who actually keeps the books — used to name the officer accountable, not to accuse. */
function ledgerOwner(data: DemoData) {
  const counts = new Map<string, number>();
  data.payments.forEach((payment) => counts.set(payment.recordedBy, (counts.get(payment.recordedBy) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "the bursary";
}

/**
 * Runs every control over the school's records and returns what needs her eye.
 * Pure and deterministic: the same ledger always produces the same findings, on
 * screen and in the emailed brief alike.
 */
export function runIntegrityChecks(data: DemoData, now = new Date()): IntegritySummary {
  const findings: Finding[] = [];
  const today = iso(now);
  const owner = ledgerOwner(data);
  // Anything she has already closed from her office stops counting against the
  // school, so the score moves as she acts on it.
  const closed = new Set(data.presidentActions.filter((action) => action.kind === "RESOLVE").map((action) => `${action.targetType}:${action.targetId}`));
  const touched = new Set<string>();
  const add = (finding: Omit<Finding, "id" | "resolved">) => {
    const resolved = closed.has(`${finding.targetType}:${finding.targetId}`);
    const fails = !resolved && (finding.severity === "CRITICAL" || finding.severity === "HIGH") && !finding.informational;
    if (fails) touched.add(finding.control);
    findings.push({ ...finding, resolved, id: `${finding.code}-${finding.targetId || findings.length}` });
  };

  const confirmed = data.payments.filter((payment) => payment.status === "CONFIRMED");
  const pending = data.payments.filter((payment) => payment.status === "PENDING_REVIEW");
  const approvals = data.expenseApprovals;

  /* ------------------------------- MONEY IN ------------------------------- */

  // Bank feed against the ledger: money that arrived and was never written down.
  const unmatchedBank = data.bankCredits.filter((credit) => credit.status !== "MATCHED");
  const unmatchedTotal = unmatchedBank.reduce((sum, credit) => sum + credit.amount, 0);
  if (unmatchedBank.length) {
    const worst = unmatchedBank.reduce((a, b) => (b.amount > a.amount ? b : a));
    add({
      code: "UNRECORDED_BANK_CREDIT",
      control: "bank-reconciliation",
      severity: "CRITICAL",
      group: "Money in",
      title: `${unmatchedBank.length} bank credit${unmatchedBank.length === 1 ? "" : "s"} with no receipt behind ${unmatchedBank.length === 1 ? "it" : "them"}`,
      plainWords: `The bank shows ${money(unmatchedTotal)} arriving that the bursary has not recorded as income. The largest is ${money(worst.amount)} from ${worst.payerName} on ${formatDate(worst.date, now)}.`,
      whatItMeans: "Money reached the school and no receipt exists for it. Until somebody explains it, only the bank knows it came in.",
      amount: unmatchedTotal,
      who: owner,
      when: formatDate(worst.date, now),
      since: worst.date,
      evidence: unmatchedBank.map((credit) => ({
        label: `${formatDate(credit.date, now)} · ${credit.payerName}`,
        value: `${money(credit.amount)} — ${credit.channel.replace("_", " ").toLowerCase()}${credit.reference ? ` · ref ${credit.reference}` : ""}${credit.note ? ` · ${credit.note}` : ""}`,
      })),
      action: "Require the bursar to identify each credit in writing within 24 hours, and post the matching receipt before the day closes.",
      allows: ["QUERY", "ESCALATE", "FLAG"],
      targetType: "bankCredit",
      targetId: worst.id,
    });
  } else {
    add({
      code: "BANK_RECONCILED",
      control: "bank-reconciliation",
      severity: "CLEAN",
      group: "Money in",
      title: "Every bank credit ties to a receipt",
      plainWords: `All ${data.bankCredits.length} credits in the bank feed match a receipt in the ledger. Nothing arrived unexplained.`,
      whatItMeans: "Income recorded and income banked agree — the first thing any auditor checks.",
      amount: null,
      who: owner,
      when: formatDate(today, now),
      since: today,
      evidence: [
        { label: "Credits in the bank feed", value: String(data.bankCredits.length) },
        { label: "Matched to a ledger receipt", value: String(data.bankCredits.filter((credit) => credit.status === "MATCHED").length) },
      ],
      action: "No action needed. This is the standard to hold every day.",
      allows: [],
      targetType: "bankCredit",
      targetId: "all",
    });
  }

  // The parent holds a receipt the ledger does not show — the incident that started this.
  const orphanConfirmations = data.parentConfirmations.filter((confirmation) => confirmation.status === "NOT_IN_LEDGER");
  if (orphanConfirmations.length) {
    const total = orphanConfirmations.reduce((sum, item) => sum + item.amount, 0);
    const corroborated = orphanConfirmations.filter((confirmation) =>
      unmatchedBank.some((credit) => credit.amount === confirmation.amount && withinDays(credit.date, confirmation.paidOn, 1)),
    );
    add({
      code: "PARENT_PAID_NOT_RECORDED",
      control: "parent-receipt",
      severity: "CRITICAL",
      group: "Money in",
      title: `${orphanConfirmations.length} parent${orphanConfirmations.length === 1 ? "" : "s"} paid; the ledger shows nothing`,
      plainWords: `${orphanConfirmations.length} famil${orphanConfirmations.length === 1 ? "y was" : "ies were"} sent a receipt automatically when they paid, totalling ${money(total)}, but no matching income appears in the bursary's books.`,
      whatItMeans: "This is how income disappears. The parent has proof and the school has no record, so the gap is only found when a family comes to complain in person. Caught here, it is found the same day.",
      amount: total,
      who: owner,
      when: formatDate(orphanConfirmations[0].paidOn, now),
      since: orphanConfirmations[0].paidOn,
      evidence: orphanConfirmations.map((confirmation) => ({
        label: `${confirmation.parentName} · ${formatDate(confirmation.paidOn, now)}`,
        value: `${money(confirmation.amount)} · ${confirmation.channel.toLowerCase()} receipt ${confirmation.receiptReference}${confirmation.acknowledgedAt ? " · the parent confirmed receiving it" : ""}`,
      })),
      action: corroborated.length
        ? `${corroborated.length} of these also appear in the bank feed, so the money certainly came in. The income must be posted today, with a written explanation of why it was missed.`
        : "Call each family to confirm what they paid and how, then require the income to be posted and the omission explained in writing.",
      allows: ["QUERY", "ESCALATE", "FLAG"],
      targetType: "parentConfirmation",
      targetId: orphanConfirmations[0].id,
    });
  } else {
    add({
      code: "PARENT_RECEIPTS_MATCHED",
      control: "parent-receipt",
      severity: "CLEAN",
      group: "Money in",
      title: "Every parent receipt is in the ledger",
      plainWords: `All ${data.parentConfirmations.length} receipts sent automatically to parents match an entry in the books.`,
      whatItMeans: "Income cannot be hidden from a parent who holds an independent receipt. Today none is missing.",
      amount: null,
      who: owner,
      when: formatDate(today, now),
      since: today,
      evidence: [{ label: "Automatic receipts issued", value: String(data.parentConfirmations.length) }],
      action: "No action needed.",
      allows: [],
      targetType: "parentConfirmation",
      targetId: "all",
    });
  }

  // Receipt book continuity: a torn-out receipt is a hidden payment.
  data.receiptBooks.forEach((book) => {
    const used = new Set(book.used);
    const voided = new Set(book.voided.map((entry) => entry.number));
    const missing: number[] = [];
    for (let number = book.firstNumber; number <= book.lastNumber; number += 1) {
      if (!used.has(number) && !voided.has(number)) missing.push(number);
    }
    if (missing.length) {
      add({
        code: "RECEIPT_BOOK_GAP",
        control: "receipt-continuity",
        severity: "HIGH",
        group: "Money in",
        title: `${missing.length} receipt number${missing.length === 1 ? "" : "s"} unaccounted for in ${book.label}`,
        plainWords: `${book.label}, held by ${book.heldBy}, skips ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}. Receipts are sequential, so a missing number means a receipt was issued and removed, or never accounted for.`,
        whatItMeans: "Removing a receipt is the oldest way to keep cash. The gap in the numbering is evidence that survives even when the paper does not.",
        amount: null,
        who: book.heldBy,
        when: formatDate(today, now),
        since: today,
        evidence: [
          { label: "Book range", value: `${book.firstNumber} – ${book.lastNumber}` },
          { label: "Numbers used", value: String(book.used.length) },
          { label: "Numbers unaccounted for", value: missing.join(", ") },
        ],
        action: `Require ${book.heldBy} to produce the counterfoil for each missing number, or report it lost in writing.`,
        allows: ["QUERY", "FLAG"],
        targetType: "receiptBook",
        targetId: book.id,
      });
    }
    const unauthorisedVoids = book.voided.filter((entry) => !entry.approvedBy || !entry.reason.trim());
    if (unauthorisedVoids.length) {
      add({
        code: "VOID_WITHOUT_APPROVAL",
        control: "receipt-continuity",
        severity: "HIGH",
        group: "Money in",
        title: `${unauthorisedVoids.length} receipt${unauthorisedVoids.length === 1 ? "" : "s"} cancelled without authority`,
        plainWords: `Receipt${unauthorisedVoids.length === 1 ? "" : "s"} ${unauthorisedVoids.map((entry) => entry.number).join(", ")} in ${book.label} ${unauthorisedVoids.length === 1 ? "was" : "were"} cancelled ${unauthorisedVoids.some((entry) => !entry.reason.trim()) ? "with no reason given" : "without an approver"}.`,
        whatItMeans: "Cancelling a receipt after collecting the money leaves the cash with no paper trail. Every cancellation needs a reason and a second signature.",
        amount: null,
        who: book.heldBy,
        when: formatDate(today, now),
        since: today,
        evidence: unauthorisedVoids.map((entry) => ({
          label: `Receipt ${entry.number}`,
          value: `${entry.reason.trim() || "no reason recorded"}${entry.approvedBy ? ` · approved by ${entry.approvedBy}` : " · no approver"}`,
        })),
        action: "Require a written reason and a countersignature for every cancelled receipt, and re-issue it where money was in fact taken.",
        allows: ["QUERY", "FLAG"],
        targetType: "receiptBook",
        targetId: book.id,
      });
    }
  });

  // Cash counted against cash recorded.
  const varianceDays = data.attestations.filter((entry) => entry.role === "BURSAR" && entry.variance !== 0);
  if (varianceDays.length) {
    const total = varianceDays.reduce((sum, entry) => sum + Math.abs(entry.variance), 0);
    add({
      code: "CASH_VARIANCE",
      control: "cash-declaration",
      severity: "CRITICAL",
      group: "Money in",
      title: `Cash counted does not match cash recorded on ${varianceDays.length} day${varianceDays.length === 1 ? "" : "s"}`,
      plainWords: `On ${varianceDays.map((entry) => formatDate(entry.date, now)).join(", ")}, the money declared at close of day differs from the ledger by ${money(total)}.`,
      whatItMeans: "A daily count that disagrees with the books is either a mistake or a withdrawal. Neither should survive a day unexplained.",
      amount: total,
      who: varianceDays.map((entry) => entry.signedBy).join(", "),
      when: formatDate(varianceDays[0].date, now),
      since: varianceDays[0].date,
      evidence: varianceDays.map((entry) => ({
        label: formatDate(entry.date, now),
        value: `declared ${money(entry.cashDeclared + entry.bankDeclared)} against ${money(entry.ledgerTotal)} recorded — ${entry.variance > 0 ? "short" : "over"} ${money(Math.abs(entry.variance))}`,
      })),
      action: "Require a signed explanation before the next declaration, and count cash with two people present.",
      allows: ["QUERY", "ESCALATE", "FLAG"],
      targetType: "attestation",
      targetId: varianceDays[0].id,
    });
  }

  // Daily declaration outstanding.
  const overdue = data.attestations.filter((entry) => entry.status === "OVERDUE");
  if (overdue.length) {
    add({
      code: "ATTESTATION_OVERDUE",
      control: "daily-attestation",
      severity: "HIGH",
      group: "Governance",
      title: `${overdue.length} daily declaration${overdue.length === 1 ? "" : "s"} not signed`,
      plainWords: overdue.map((entry) => `${entry.role === "BURSAR" ? "The bursar" : "The head teacher"} has not signed the declaration for ${formatDate(entry.date, now)}`).join("; ") + ".",
      whatItMeans: "The daily signature is what makes one named person answerable for that day's money. Without it, nobody has said the day is complete.",
      amount: null,
      who: overdue.map((entry) => entry.signedBy).join(", "),
      when: formatDate(overdue[0].date, now),
      since: overdue[0].date,
      evidence: overdue.map((entry) => ({ label: `${entry.role === "BURSAR" ? "Bursar" : "Head teacher"} · ${formatDate(entry.date, now)}`, value: entry.note || "not signed" })),
      action: "Make the declaration a condition of closing the bursary each day, and treat a missed signature as a reportable matter.",
      allows: ["QUERY", "FLAG"],
      targetType: "attestation",
      targetId: overdue[0].id,
    });
  }

  // Transfers left unconfirmed.
  const stalePending = pending.filter((payment) => !withinDays(payment.paidAt, today, CONTROL_POLICY.pendingReviewDays));
  if (stalePending.length) {
    const total = stalePending.reduce((sum, payment) => sum + payment.amount, 0);
    add({
      code: "STALE_PENDING_REVIEW",
      control: "confirmation-sla",
      severity: "HIGH",
      group: "Money in",
      title: `${stalePending.length} payment${stalePending.length === 1 ? "" : "s"} waiting more than ${CONTROL_POLICY.pendingReviewDays} days`,
      plainWords: `${money(total)} across ${stalePending.length} transfer${stalePending.length === 1 ? " has" : "s have"} sat as "awaiting confirmation" since ${formatDate(stalePending[0].paidAt, now)}.`,
      whatItMeans: "Unconfirmed money is invisible in every report. A transfer left pending can later be confirmed against a different pupil, or never confirmed at all.",
      amount: total,
      who: stalePending[0].recordedBy,
      when: formatDate(stalePending[0].paidAt, now),
      since: stalePending[0].paidAt,
      evidence: stalePending.slice(0, 8).map((payment) => ({
        label: `${payment.receiptNumber} · ${formatDate(payment.paidAt, now)}`,
        value: `${money(payment.amount)} · ${payment.bank}`,
      })),
      action: "Require confirmation or refusal within one working day, with the bank reference checked against the feed.",
      allows: ["QUERY", "FLAG"],
      targetType: "payment",
      targetId: stalePending[0].id,
    });
  }

  // Cash must reach the bank. The bank feed carries the deposit, so this can be
  // proved without asking the bursary whether she banked it.
  const deposits = new Map<string, number>();
  data.bankCredits.filter((credit) => credit.channel === "CASH_DEPOSIT").forEach((credit) => deposits.set(credit.date, (deposits.get(credit.date) ?? 0) + credit.amount));
  const cashDays = new Map<string, number>();
  confirmed.filter((payment) => payment.method === "CASH_BURSARY").forEach((payment) => cashDays.set(payment.paidAt, (cashDays.get(payment.paidAt) ?? 0) + payment.amount));
  const unbanked = [...cashDays.entries()].filter(([date, taken]) => (deposits.get(date) ?? 0) < taken - 1).sort((a, b) => a[0].localeCompare(b[0]));
  if (unbanked.length) {
    const total = unbanked.reduce((sum, [, taken]) => sum + taken - (deposits.get("") ?? 0), 0);
    add({
      code: "CASH_UNBANKED",
      control: "cash-banking",
      severity: "HIGH",
      group: "Money in",
      title: `${unbanked.length} day${unbanked.length === 1 ? "" : "s"} of cash never reached the bank`,
      plainWords: `Cash was taken at the counter on ${unbanked.length} day${unbanked.length === 1 ? "" : "s"} with no matching deposit in the bank feed, the earliest being ${formatDate(unbanked[0][0], now)}.`,
      whatItMeans: "Cash that stays in a drawer can be spent, replaced later, or counted differently. Once it is in the bank, the bank's own statement proves it arrived.",
      amount: unbanked.reduce((sum, [, taken]) => sum + taken, 0) - unbanked.reduce((sum, [date]) => sum + (deposits.get(date) ?? 0), 0),
      who: owner,
      when: formatDate(unbanked[0][0], now),
      since: unbanked[0][0],
      evidence: unbanked.slice(0, 6).map(([date, taken]) => ({
        label: formatDate(date, now),
        value: `${money(taken)} taken · ${money(deposits.get(date) ?? 0)} banked`,
      })),
      action: "Demand the deposit slips for these dates. Where none exist, treat the cash as unaccounted for and recover it.",
      allows: ["QUERY", "ESCALATE", "FLAG"],
      targetType: "payment",
      targetId: `cash-${unbanked[0][0]}`,
    });
    void total;
  } else {
    add({
      code: "CASH_BANKED_SAME_DAY",
      control: "cash-banking",
      severity: "CLEAN",
      group: "Money in",
      title: "Every day's cash reached the bank",
      plainWords: `Cash was taken on ${cashDays.size} day${cashDays.size === 1 ? "" : "s"} this term and the bank feed shows a deposit for each one.`,
      whatItMeans: "The cash in the drawer and the cash in the bank agree, day by day, without anybody having to promise it.",
      amount: null,
      who: owner,
      when: formatDate(today, now),
      since: today,
      evidence: [{ label: "Cash days checked", value: String(cashDays.size) }],
      action: "No action needed.",
      allows: [],
      targetType: "payment",
      targetId: "cash-banking",
    });
  }

  // Large cash payments are a note, not a breach, while they are banked the same day.
  const cashOverCeiling = confirmed.filter((payment) => payment.method === "CASH_BURSARY" && payment.amount > CONTROL_POLICY.cashCeiling);
  if (cashOverCeiling.length) {
    add({
      code: "CASH_OVER_CEILING",
      control: "cash-banking",
      severity: "WATCH",
      group: "Money in",
      title: `${cashOverCeiling.length} famil${cashOverCeiling.length === 1 ? "y" : "ies"} paid more than ${money(CONTROL_POLICY.cashCeiling)} in cash`,
      plainWords: `${cashOverCeiling.length} payment${cashOverCeiling.length === 1 ? " was" : "s were"} made in cash above the ${money(CONTROL_POLICY.cashCeiling)} counter limit. All of them were banked, so nothing is missing — but large cash is harder to trace than a transfer.`,
      whatItMeans: "A transfer leaves its own trail at the bank. Cash depends on somebody writing it down, so the less of it the better.",
      amount: cashOverCeiling.reduce((sum, payment) => sum + payment.amount, 0),
      who: cashOverCeiling[0].recordedBy,
      when: formatDate(cashOverCeiling[0].paidAt, now),
      since: cashOverCeiling[0].paidAt,
      evidence: cashOverCeiling.slice(0, 6).map((payment) => ({ label: `${payment.receiptNumber} · ${formatDate(payment.paidAt, now)}`, value: money(payment.amount) })),
      action: "Ask the bursary to move fees above this amount to transfer only from next term.",
      allows: ["QUERY", "FLAG"],
      targetType: "payment",
      targetId: cashOverCeiling[0].id,
    });
  }

  // The bank feed itself must keep arriving, or nothing else can be checked.
  const lastFeed = data.bankCredits.map((credit) => credit.date).sort().pop();
  if (!lastFeed || !withinDays(lastFeed, today, 5)) {
    add({
      code: "BANK_FEED_GAP",
      control: "bank-feed-currency",
      severity: "HIGH",
      group: "Money in",
      title: "The bank feed has gone quiet",
      plainWords: lastFeed
        ? `The last credit the bank reported was ${formatDate(lastFeed, now)}. Nothing has arrived since.`
        : "No bank feed has reached the system at all.",
      whatItMeans: "Reconciliation only works while the bank's own statement keeps arriving. A quiet feed is a day nobody can check the bursary against.",
      amount: null,
      who: owner,
      when: lastFeed ? formatDate(lastFeed, now) : formatDate(today, now),
      since: lastFeed ?? today,
      evidence: [
        { label: "Last credit reported by the bank", value: lastFeed ? formatDate(lastFeed, now) : "never" },
        { label: "Credits on file", value: String(data.bankCredits.length) },
      ],
      action: "Ask the bank for the missing statements and confirm the feed is scheduled to arrive every working day.",
      allows: ["QUERY", "FLAG"],
      targetType: "bankCredit",
      targetId: "feed",
    });
  } else {
    add({
      code: "BANK_FEED_CURRENT",
      control: "bank-feed-currency",
      severity: "CLEAN",
      group: "Money in",
      title: "The bank feed is arriving",
      plainWords: `The bank last reported activity on ${formatDate(lastFeed, now)}, covering ${data.bankCredits.length} credits this term.`,
      whatItMeans: "An independent statement of what the school actually received, arriving without help from the bursary.",
      amount: null,
      who: "The bank",
      when: formatDate(lastFeed, now),
      since: lastFeed,
      evidence: [{ label: "Most recent credit", value: formatDate(lastFeed, now) }],
      action: "No action needed.",
      allows: [],
      targetType: "bankCredit",
      targetId: "feed",
    });
  }

  // One person collecting, recording, confirming and reconciling.
  const recorders = new Map<string, number>();
  data.payments.forEach((payment) => recorders.set(payment.recordedBy, (recorders.get(payment.recordedBy) ?? 0) + 1));
  const topRecorder = [...recorders.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topRecorder && data.payments.length > 4 && topRecorder[1] / data.payments.length > 0.9) {
    add({
      code: "SINGLE_POINT_CONTROL",
      control: "segregation-of-duties",
      severity: "WATCH",
      group: "Governance",
      title: "One person handles almost all of the money coming in",
      plainWords: `${topRecorder[0]} recorded ${topRecorder[1]} of the ${data.payments.length} payments this term — ${Math.round((topRecorder[1] / data.payments.length) * 100)}% of everything.`,
      whatItMeans: "When one officer collects, records, confirms and reconciles, there is no second pair of eyes. That is the condition in which money goes missing unnoticed.",
      amount: null,
      who: topRecorder[0],
      when: formatDate(today, now),
      since: today,
      evidence: [
        { label: "Payments recorded by this officer", value: `${topRecorder[1]} of ${data.payments.length}` },
        { label: "Bank reconciliation performed by", value: "the same officer" },
        { label: "Independent check on record", value: "none" },
      ],
      action: "Split the duty: one person receives, another posts the ledger, and a third reconciles the bank each month.",
      allows: ["QUERY", "ESCALATE"],
      targetType: "governance",
      targetId: "segregation-of-duties",
    });
  }

  /* ------------------------------- MONEY OUT ------------------------------ */

  // Paid without the approval the policy requires.
  const unapproved = approvals.filter((entry) => entry.status === "PAID_WITHOUT_APPROVAL");
  if (unapproved.length) {
    const total = unapproved.reduce((sum, entry) => sum + entry.amount, 0);
    const largest = unapproved.reduce((a, b) => (b.amount > a.amount ? b : a));
    add({
      code: "PAID_WITHOUT_APPROVAL",
      control: "expense-authorisation",
      severity: "CRITICAL",
      group: "Money out",
      title: `${unapproved.length} payment${unapproved.length === 1 ? "" : "s"} made without approval`,
      plainWords: `${money(total)} left the school on ${unapproved.length} payment${unapproved.length === 1 ? "" : "s"} nobody authorised. The largest is ${money(largest.amount)} to ${largest.vendor}.`,
      whatItMeans: "This is spending you did not agree to and may not know about. Money already gone is far harder to recover than money stopped before it leaves.",
      amount: total,
      who: unapproved.map((entry) => entry.requestedBy).filter((name, index, all) => all.indexOf(name) === index).join(", "),
      when: formatDate(largest.date, now),
      since: largest.date,
      evidence: unapproved.map((entry) => ({
        label: `${formatDate(entry.date, now)} · ${entry.vendor}`,
        value: `${money(entry.amount)} — ${entry.description}${entry.evidence ? "" : " · no invoice attached"}`,
      })),
      action: "Require a written explanation from each requester, recover what cannot be justified, and block payment above the limit without your approval.",
      allows: ["QUERY", "ESCALATE", "FLAG", "REJECT"],
      targetType: "expenseApproval",
      targetId: unapproved[0].id,
    });
  } else {
    add({
      code: "ALL_AUTHORISED",
      control: "expense-authorisation",
      severity: "CLEAN",
      group: "Money out",
      title: "Every payment this term was authorised",
      plainWords: `All ${approvals.filter((entry) => entry.paidAt).length} payments made this term carry an approval.`,
      whatItMeans: "Nobody can spend the school's money without a name against it.",
      amount: null,
      who: owner,
      when: formatDate(today, now),
      since: today,
      evidence: [{ label: "Payments with an approver", value: String(approvals.filter((entry) => entry.paidAt && entry.approvedBy).length) }],
      action: "No action needed.",
      allows: [],
      targetType: "expenseApproval",
      targetId: "all",
    });
  }

  // Split purchases: three or more payments under a limit that add up to over it.
  const byVendor = new Map<string, ExpenseApproval[]>();
  approvals.forEach((entry) => {
    byVendor.set(entry.vendor, [...(byVendor.get(entry.vendor) ?? []), entry]);
  });
  byVendor.forEach((entries, vendor) => {
    const candidates = entries.filter((entry) => entry.amount < CONTROL_POLICY.bursarApprovalCeiling && entry.amount >= CONTROL_POLICY.bursarApprovalCeiling * 0.6);
    const reported = new Set<string>();
    for (const anchor of candidates) {
      if (reported.has(anchor.id)) continue;
      const cluster = candidates.filter((entry) => withinDays(entry.date, anchor.date, CONTROL_POLICY.splitWindowDays));
      const total = cluster.reduce((sum, entry) => sum + entry.amount, 0);
      if (cluster.length >= 3 && total >= CONTROL_POLICY.bursarApprovalCeiling) {
        cluster.forEach((entry) => reported.add(entry.id));
        add({
          code: "SPLIT_PURCHASE",
          control: "purchase-integrity",
          severity: "CRITICAL",
          group: "Money out",
          title: `A purchase from ${vendor} was split to stay under your approval limit`,
          plainWords: `${cluster.length} payments of ${cluster.map((entry) => money(entry.amount)).join(", ")} went to ${vendor} within ${CONTROL_POLICY.splitWindowDays} days — ${money(total)} together, above the ${money(CONTROL_POLICY.bursarApprovalCeiling)} limit that needs your approval.`,
          whatItMeans: "Splitting a purchase is a deliberate way to avoid an approval limit. Each amount looks routine; the total is not.",
          amount: total,
          who: cluster.map((entry) => entry.requestedBy).filter((name, index, all) => all.indexOf(name) === index).join(", "),
          when: formatDate(anchor.date, now),
          since: anchor.date,
          evidence: cluster.map((entry) => ({
            label: `${formatDate(entry.date, now)} · ${entry.description}`,
            value: `${money(entry.amount)}${entry.approvedBy ? ` · approved by ${entry.approvedBy}` : " · no approval"}`,
          })),
          action: "Treat the cluster as one purchase needing your approval, and ask why it was not raised as a single request.",
          allows: ["QUERY", "ESCALATE", "REJECT", "FLAG"],
          targetType: "expenseApproval",
          targetId: cluster[0].id,
        });
      }
    }
  });

  // Duplicates — judged against the vendor's own usual rhythm, so standing
  // commitments (a weekly market run, a monthly contract) are not flagged.
  const byVendorAmount = new Map<string, ExpenseApproval[]>();
  approvals.forEach((entry) => {
    const key = `${entry.vendor}|${entry.amount}`;
    byVendorAmount.set(key, [...(byVendorAmount.get(key) ?? []), entry]);
  });
  const duplicates: { entry: ExpenseApproval; twin: ExpenseApproval; usualGap: number }[] = [];
  byVendorAmount.forEach((entries) => {
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((entry, index) => Math.round((new Date(entry.date).getTime() - new Date(sorted[index].date).getTime()) / 86400000));
    const usualGap = median(gaps);
    sorted.slice(1).forEach((entry, index) => {
      const gap = Math.round((new Date(entry.date).getTime() - new Date(sorted[index].date).getTime()) / 86400000);
      const suspicious = usualGap >= CONTROL_POLICY.duplicateWindowDays ? gap < usualGap / 2 : gap <= CONTROL_POLICY.duplicateWindowDays && usualGap > gap * 2;
      if (suspicious && gap <= CONTROL_POLICY.duplicateWindowDays) duplicates.push({ entry, twin: sorted[index], usualGap });
    });
  });
  if (duplicates.length) {
    duplicates.forEach(({ entry, twin, usualGap }) => {
      add({
        code: "DUPLICATE_PAYMENT",
        control: "duplicate-payment",
        severity: "HIGH",
        group: "Money out",
        title: `${entry.vendor} may have been paid twice for one job`,
        plainWords: (() => {
          const days = Math.round(Math.abs(new Date(entry.date).getTime() - new Date(twin.date).getTime()) / 86400000);
          return `${money(entry.amount)} went to ${entry.vendor} on ${formatDate(entry.date, now)}, only ${days} day${days === 1 ? "" : "s"} after an identical payment. This vendor is normally paid about every ${usualGap} days.`;
        })(),
        whatItMeans: "Duplicates are easy to make and easy to invent. Either way the school paid twice for one delivery.",
        amount: entry.amount,
        who: entry.requestedBy,
        when: formatDate(entry.date, now),
        since: entry.date,
        evidence: [
          { label: "First payment", value: `${formatDate(twin.date, now)} · ${money(twin.amount)} · ${twin.description}` },
          { label: "Second payment", value: `${formatDate(entry.date, now)} · ${money(entry.amount)} · ${entry.description}` },
          { label: "Usual gap for this vendor", value: `${usualGap} days` },
          ...(entry.invoiceRef ? [{ label: "Invoice reference", value: entry.invoiceRef }] : []),
        ],
        action: "Confirm the delivery happened once, then recover the second payment or credit it against the next invoice.",
        allows: ["QUERY", "FLAG", "REJECT"],
        targetType: "expenseApproval",
        targetId: entry.id,
      });
    });
  }

  // No document behind the payment.
  const noEvidence = approvals.filter((entry) => !entry.evidence && entry.amount >= CONTROL_POLICY.bursarApprovalCeiling * 0.25);
  if (noEvidence.length) {
    add({
      code: "NO_EVIDENCE",
      control: "supporting-documents",
      severity: "HIGH",
      group: "Money out",
      title: `${noEvidence.length} payment${noEvidence.length === 1 ? "" : "s"} with no invoice or receipt attached`,
      plainWords: `${money(noEvidence.reduce((sum, entry) => sum + entry.amount, 0))} was paid across ${noEvidence.length} expense${noEvidence.length === 1 ? "" : "s"} with nothing filed to show what it bought.`,
      whatItMeans: "Without a document there is no way to check the price, the supplier, or whether anything arrived. It is also the first thing an auditor asks for.",
      amount: noEvidence.reduce((sum, entry) => sum + entry.amount, 0),
      who: noEvidence.map((entry) => entry.requestedBy).filter((name, index, all) => all.indexOf(name) === index).join(", "),
      when: formatDate(noEvidence[0].date, now),
      since: noEvidence[0].date,
      evidence: noEvidence.slice(0, 8).map((entry) => ({ label: `${formatDate(entry.date, now)} · ${entry.vendor}`, value: `${money(entry.amount)} — ${entry.description}` })),
      action: "Require the document before the next payment to that vendor, and refuse cash expenses above the limit.",
      allows: ["QUERY", "FLAG"],
      targetType: "expenseApproval",
      targetId: noEvidence[0].id,
    });
  }

  // The requester also approved it.
  const selfApproved = approvals.filter((entry) => entry.approvedBy && entry.requestedBy === entry.approvedBy);
  if (selfApproved.length) {
    add({
      code: "SELF_APPROVED",
      control: "self-approval",
      severity: "CRITICAL",
      group: "Money out",
      title: `${selfApproved.length} payment${selfApproved.length === 1 ? "" : "s"} approved by the person who requested ${selfApproved.length === 1 ? "it" : "them"}`,
      plainWords: `${selfApproved.map((entry) => entry.requestedBy).filter((name, index, all) => all.indexOf(name) === index).join(", ")} both raised and approved ${selfApproved.length === 1 ? "this request" : `these ${selfApproved.length} requests`} — ${money(selfApproved.reduce((sum, entry) => sum + entry.amount, 0))} in total.`,
      whatItMeans: "An approval from the requester is not an approval. This is the control whose absence most often precedes a loss.",
      amount: selfApproved.reduce((sum, entry) => sum + entry.amount, 0),
      who: selfApproved[0].requestedBy,
      when: formatDate(selfApproved[0].date, now),
      since: selfApproved[0].date,
      evidence: selfApproved.slice(0, 6).map((entry) => ({
        label: `${formatDate(entry.date, now)} · ${entry.vendor}`,
        value: `${money(entry.amount)} — requested and approved by ${entry.requestedBy}`,
      })),
      action: "Void these approvals and require a second signature: nobody may approve their own request, at any amount.",
      allows: ["REJECT", "QUERY", "ESCALATE", "FLAG"],
      targetType: "expenseApproval",
      targetId: selfApproved[0].id,
    });
  }

  // Waiting on her decision — the control working, not failing.
  const awaiting = approvals.filter((entry) => entry.status === "PENDING" && entry.amount >= CONTROL_POLICY.bursarApprovalCeiling);
  if (awaiting.length) {
    add({
      code: "AWAITING_PRESIDENT",
      control: "approval-queue",
      severity: "WATCH",
      informational: true,
      group: "Money out",
      title: `${awaiting.length} request${awaiting.length === 1 ? "" : "s"} waiting for your approval`,
      plainWords: `${money(awaiting.reduce((sum, entry) => sum + entry.amount, 0))} across ${awaiting.length} request${awaiting.length === 1 ? "" : "s"} is above the bursar's ${money(CONTROL_POLICY.bursarApprovalCeiling)} limit and cannot be paid until you decide.`,
      whatItMeans: "Nothing has gone wrong — this is the control working. Work stops here until you approve or refuse.",
      amount: awaiting.reduce((sum, entry) => sum + entry.amount, 0),
      who: awaiting.map((entry) => entry.requestedBy).join(", "),
      when: formatDate(awaiting[0].date, now),
      since: awaiting[0].date,
      evidence: awaiting.map((entry) => ({
        label: `${entry.vendor} · ${entry.category}`,
        value: `${money(entry.amount)} — ${entry.description}${entry.evidence ? " · documents attached" : " · no quote attached yet"}`,
      })),
      action: "Approve or refuse from the Approvals tab. Refusing costs nothing; silence lets the request age.",
      allows: ["APPROVE", "REJECT", "QUERY"],
      targetType: "expenseApproval",
      targetId: awaiting[0].id,
    });
  }

  // Budget discipline, with the term's remaining time in view.
  data.budgets.forEach((budget) => {
    const spent = data.expenses.filter((expense) => expense.category === budget.category).reduce((sum, expense) => sum + expense.amount, 0);
    if (!budget.allocated) return;
    const share = spent / budget.allocated;
    if (share > 1) {
      add({
        code: "OVER_BUDGET",
        control: "budget-discipline",
        severity: "HIGH",
        group: "Money out",
        title: `${budget.category} has overspent its budget`,
        plainWords: `${money(spent)} has gone on ${budget.category.toLowerCase()} against the ${money(budget.allocated)} allowed for the term — ${money(spent - budget.allocated)} over, with ${formatDate(data.settings.termEndDate, now)} still to come.`,
        whatItMeans: "An overrun this early means the rest of the term gets funded from somewhere else, often fees meant for something else.",
        amount: spent - budget.allocated,
        who: owner,
        when: formatDate(today, now),
        since: today,
        evidence: [
          { label: "Allowed this term", value: money(budget.allocated) },
          { label: "Spent so far", value: `${money(spent)} (${Math.round(share * 100)}%)` },
          { label: "Term ends", value: formatDate(data.settings.termEndDate, now) },
        ],
        action: "Freeze further spending in this category until you approve a revised budget.",
        allows: ["QUERY", "FLAG", "ESCALATE"],
        targetType: "budget",
        targetId: budget.id,
      });
    } else if (share > 0.85) {
      add({
        code: "BUDGET_NEAR_LIMIT",
        control: "budget-discipline",
        severity: "WATCH",
        group: "Money out",
        title: `${budget.category} is close to its budget`,
        plainWords: `${Math.round(share * 100)}% of the ${money(budget.allocated)} allowed for ${budget.category.toLowerCase()} has been spent, with the term still running.`,
        whatItMeans: "Worth knowing before it becomes an overrun, not after.",
        amount: budget.allocated - spent,
        who: owner,
        when: formatDate(today, now),
        since: today,
        evidence: [
          { label: "Allowed this term", value: money(budget.allocated) },
          { label: "Spent so far", value: money(spent) },
          { label: "Remaining", value: money(budget.allocated - spent) },
        ],
        action: "Ask for a forecast to the end of term before approving more in this category.",
        allows: ["QUERY"],
        targetType: "budget",
        targetId: budget.id,
      });
    }
  });

  /* -------------------------------- PAYROLL -------------------------------- */

  const paidRoster = staffOnPayroll(data);
  const activeRoster = data.staff.filter((member) => member.status !== "RESIGNED").length;
  const payroll = data.expenses.filter((expense) => expense.category === "Salaries & wages").slice(-1)[0];
  if (paidRoster > activeRoster) {
    const resigned = data.staff.filter((member) => member.status === "RESIGNED");
    const averageSalary = payroll ? Math.round(payroll.amount / Math.max(1, paidRoster)) : 0;
    add({
      code: "GHOST_STAFF",
      control: "payroll-integrity",
      severity: "CRITICAL",
      group: "Payroll",
      title: `Payroll covers ${paidRoster} people; only ${activeRoster} work here`,
      plainWords: `The last payroll run paid ${paidRoster} staff, but ${activeRoster} are on the active list. ${resigned.map((member) => `${member.title} ${member.firstName} ${member.lastName}`).join(", ") || "Somebody"} has left and may still be drawing a salary.`,
      whatItMeans: "A salary paid to somebody who has left goes into an account nobody checks. It is the most common form of payroll fraud in schools.",
      amount: averageSalary * (paidRoster - activeRoster),
      who: owner,
      when: payroll ? formatDate(payroll.date, now) : formatDate(today, now),
      since: payroll?.date ?? today,
      evidence: [
        { label: "Staff covered by the last run", value: String(paidRoster) },
        { label: "Active staff on the roster", value: String(activeRoster) },
        ...(resigned.length ? [{ label: "Left the school", value: resigned.map((member) => `${member.title} ${member.firstName} ${member.lastName}`).join(", ") }] : []),
        ...(averageSalary ? [{ label: "Estimated cost per person", value: money(averageSalary) }] : []),
        ...(payroll ? [{ label: "Payroll approved by", value: payroll.approvedBy }] : []),
      ],
      action: "Stop the next run until every name is matched to a person who works here, and ask the bank where the extra salaries went.",
      allows: ["QUERY", "ESCALATE", "FLAG", "REJECT"],
      targetType: "payroll",
      targetId: payroll?.id ?? "payroll",
    });
  }

  const payrollRuns = data.expenses.filter((expense) => expense.category === "Salaries & wages").sort((a, b) => a.date.localeCompare(b.date));
  if (payrollRuns.length >= 2) {
    const latest = payrollRuns[payrollRuns.length - 1];
    const previous = payrollRuns[payrollRuns.length - 2];
    const change = latest.amount - previous.amount;
    if (previous.amount && Math.abs(change) / previous.amount > 0.05) {
      add({
        code: "PAYROLL_JUMP",
        control: "payroll-movement",
        severity: change > 0 ? "HIGH" : "WATCH",
        group: "Payroll",
        title: `Payroll ${change > 0 ? "rose" : "fell"} ${Math.round((Math.abs(change) / previous.amount) * 100)}% in one month`,
        plainWords: `Payroll went from ${money(previous.amount)} in ${formatDate(previous.date, now)} to ${money(latest.amount)} in ${formatDate(latest.date, now)} — ${change > 0 ? "an increase of" : "a decrease of"} ${money(Math.abs(change))}.`,
        whatItMeans: change > 0
          ? "Payroll should move only when staff join, leave or are promoted. An unexplained rise is where hidden salaries appear."
          : "A fall usually means somebody left, or was not paid. Either is worth confirming.",
        amount: Math.abs(change),
        who: owner,
        when: formatDate(latest.date, now),
        since: latest.date,
        evidence: [
          { label: formatDate(previous.date, now), value: money(previous.amount) },
          { label: formatDate(latest.date, now), value: money(latest.amount) },
          { label: "Movement", value: `${change > 0 ? "+" : "−"}${money(Math.abs(change))}` },
        ],
        action: "Ask for the schedule behind the change — names, grades, and the approval for each movement.",
        allows: ["QUERY", "FLAG"],
        targetType: "expense",
        targetId: latest.id,
      });
    }
  }

  /* ------------------------------ GOVERNANCE ------------------------------ */

  data.auditLog
    .filter((entry) => entry.severity === "ALERT")
    .forEach((entry) => {
      add({
        code: "RECORD_TAMPERED",
        control: "record-integrity",
        severity: "CRITICAL",
        group: "Governance",
        title: entry.action,
        plainWords: entry.detail,
        whatItMeans: auditWhy(entry.action),
        amount: entry.amount,
        who: entry.actor,
        when: formatDate(entry.at.slice(0, 10), now),
        since: entry.at.slice(0, 10),
        evidence: [
          { label: "Who", value: entry.actor },
          { label: "When", value: new Date(entry.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) },
          { label: "Record touched", value: `${entry.targetType} · ${entry.targetId}` },
          ...(entry.amount ? [{ label: "Amount involved", value: money(entry.amount) }] : []),
        ],
        action: "Ask for the reason in writing, and reverse the change if it cannot be justified.",
        allows: ["QUERY", "ESCALATE", "FLAG", "RESOLVE"],
        targetType: entry.targetType,
        targetId: entry.id,
      });
    });

  const oddHours = data.auditLog.filter((entry) => {
    const when = new Date(entry.at);
    return when.getDay() === 0 || when.getDay() === 6 || when.getHours() < 6 || when.getHours() >= 21;
  });
  if (oddHours.length) {
    add({
      code: "AFTER_HOURS_ENTRY",
      control: "working-hours",
      severity: "WATCH",
      group: "Governance",
      title: `${oddHours.length} record change${oddHours.length === 1 ? "" : "s"} made outside working hours`,
      plainWords: `${oddHours.length} change${oddHours.length === 1 ? " was" : "s were"} made to the money records at the weekend, before 6:00 AM or after 9:00 PM.`,
      whatItMeans: "Legitimate work happens in office hours. Changes made when nobody is around deserve a question, not an accusation.",
      amount: oddHours.reduce((sum, entry) => sum + (entry.amount ?? 0), 0) || null,
      who: oddHours.map((entry) => entry.actor).filter((name, index, all) => all.indexOf(name) === index).join(", "),
      when: formatDate(oddHours[0].at.slice(0, 10), now),
      since: oddHours[0].at.slice(0, 10),
      evidence: oddHours.slice(0, 6).map((entry) => ({
        label: new Date(entry.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }),
        value: `${entry.actor} — ${entry.action}`,
      })),
      action: "Ask why the work could not wait, and require approval for out-of-hours changes.",
      allows: ["QUERY", "FLAG"],
      targetType: "audit",
      targetId: oddHours[0].id,
    });
  }

  const openConcerns = data.concerns.filter((concern) => concern.status !== "RESOLVED");
  if (openConcerns.length) {
    add({
      code: "OPEN_CONCERNS",
      control: "concern-response",
      severity: openConcerns.some((concern) => (concern.amount ?? 0) > CONTROL_POLICY.bursarApprovalCeiling) ? "HIGH" : "WATCH",
      group: "Governance",
      title: `${openConcerns.length} concern${openConcerns.length === 1 ? "" : "s"} raised and still open`,
      plainWords: openConcerns.map((concern) => `${concern.anonymous ? "Somebody" : concern.raisedBy} reported: "${concern.subject}"`).join(" "),
      whatItMeans: "People only keep reporting what they see if reports lead somewhere. An unanswered concern is a control that has stopped working.",
      amount: openConcerns.reduce((sum, concern) => sum + (concern.amount ?? 0), 0) || null,
      who: openConcerns.map((concern) => (concern.anonymous ? "the confidential line" : concern.raisedBy)).join(", "),
      when: formatDate(openConcerns[0].raisedAt.slice(0, 10), now),
      since: openConcerns[0].raisedAt.slice(0, 10),
      evidence: openConcerns.map((concern) => ({
        label: `${concern.channel.replace("_", " ").toLowerCase()} · ${concern.anonymous ? "anonymous" : concern.raisedBy}`,
        value: `${concern.subject} — ${concern.status.toLowerCase()}${concern.amount ? ` · ${money(concern.amount)}` : ""}`,
      })),
      action: "Answer each one, even if only to say what you found. Close nothing without a written outcome.",
      allows: ["QUERY", "ESCALATE", "RESOLVE", "FLAG"],
      targetType: "concern",
      targetId: openConcerns[0].id,
    });
  }

  // Critical matters left open past the escalation window.
  const staleCritical = findings.filter(
    (finding) => finding.severity === "CRITICAL" && !finding.resolved && !withinDays(finding.since, today, 1),
  );
  if (staleCritical.length) {
    add({
      code: "ESCALATION_SLA",
      control: "escalation",
      severity: "WATCH",
      group: "Governance",
      title: `${staleCritical.length} critical matter${staleCritical.length === 1 ? "" : "s"} older than ${CONTROL_POLICY.escalationHours} hours`,
      plainWords: `${staleCritical.length} matter${staleCritical.length === 1 ? "" : "s"} rated critical ${staleCritical.length === 1 ? "has" : "have"} been open for more than a day. Policy is to escalate to the executive board at that point.`,
      whatItMeans: "An open critical finding is money still unaccounted for. The clock is what stops it becoming normal.",
      amount: staleCritical.reduce((sum, finding) => sum + (finding.amount ?? 0), 0),
      who: "President's Office",
      when: formatDate(today, now),
      since: staleCritical[0].since,
      evidence: staleCritical.slice(0, 6).map((finding) => ({ label: finding.title, value: `${finding.amount ? money(finding.amount) : "no amount"} · since ${finding.when}` })),
      action: "Close each one, or escalate it to the board with a note of what you asked for.",
      allows: ["ESCALATE", "RESOLVE"],
      targetType: "governance",
      targetId: "escalation",
    });
  }

  // Documents filed with payments — reported when it is going well, too.
  const evidenceRate = approvals.length ? approvals.filter((entry) => entry.evidence).length / approvals.length : 1;
  if (evidenceRate >= 0.9) {
    add({
      code: "EVIDENCE_FILED",
      control: "supporting-documents",
      severity: "CLEAN",
      group: "Money out",
      title: "Invoices are being filed with payments",
      plainWords: `${Math.round(evidenceRate * 100)}% of the term's payments have an invoice, quote or receipt attached.`,
      whatItMeans: "Documents on file mean a price can be checked and a delivery can be proved.",
      amount: null,
      who: owner,
      when: formatDate(today, now),
      since: today,
      evidence: [{ label: "Payments with documents", value: `${approvals.filter((entry) => entry.evidence).length} of ${approvals.length}` }],
      action: "No action needed.",
      allows: [],
      targetType: "expenseApproval",
      targetId: "all",
    });
  }

  /* -------------------------------- SUMMARY -------------------------------- */

  const open = findings.filter((finding) => !finding.resolved);
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, WATCH: 0, CLEAN: 0 };
  open.forEach((finding) => {
    counts[finding.severity] += 1;
  });

  const liveCodes = new Set(open.map((finding) => finding.code));
  const hiddenIncome = liveCodes.has("UNRECORDED_BANK_CREDIT")
    ? unmatchedTotal +
    orphanConfirmations
      .filter((confirmation) => !unmatchedBank.some((credit) => credit.amount === confirmation.amount && withinDays(credit.date, confirmation.paidOn, 1)))
      .reduce((sum, confirmation) => sum + confirmation.amount, 0) +
    varianceDays.reduce((sum, entry) => sum + Math.max(0, entry.variance), 0)
    : 0;
  const unapprovedSpend =
    (liveCodes.has("PAID_WITHOUT_APPROVAL") ? unapproved.reduce((sum, entry) => sum + entry.amount, 0) : 0) +
    (liveCodes.has("SELF_APPROVED") ? selfApproved.reduce((sum, entry) => sum + entry.amount, 0) : 0);

  const failedControls = touched;
  const controlsHeld = CONTROLS.length - failedControls.size;
  const register = CONTROLS.map((control) => {
    const own = open.filter((finding) => finding.control === control.id && finding.severity !== "CLEAN" && !finding.informational);
    const clean = open.find((finding) => finding.control === control.id && finding.severity === "CLEAN");
    const status: Severity = own.length ? SEVERITY_ORDER.find((level) => own.some((finding) => finding.severity === level))! : "CLEAN";
    return { control, status, findings: [...own, ...(clean ? [clean] : [])] };
  });

  return {
    findings: findings.sort(
      (a, b) =>
        Number(a.resolved) - Number(b.resolved) ||
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        (b.amount ?? 0) - (a.amount ?? 0),
    ),
    resolvedCount: findings.length - open.length,
    counts,
    exposure: hiddenIncome + unapprovedSpend,
    hiddenIncome,
    unapprovedSpend,
    controlsHeld,
    controlsFailed: failedControls.size,
    controlsTotal: CONTROLS.length,
    assurance: Math.round((controlsHeld / CONTROLS.length) * 100),
    register,
    openConcerns: openConcerns.length,
    awaitingHer: awaiting.length,
  };
}

/** How many people the last payroll run covered, read from the payroll line itself. */
function staffOnPayroll(data: DemoData): number {
  const payroll = data.expenses.filter((expense) => expense.category === "Salaries & wages").slice(-1)[0];
  const match = payroll?.description.match(/(\d+)\s+staff/i);
  return match ? Number(match[1]) : data.staff.filter((member) => member.status !== "RESIGNED").length;
}

function auditWhy(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes("backdat")) return "Backdating puts a payment into a period that has already been reported and closed.";
  if (lower.includes("delet") || lower.includes("remov")) return "A deleted record leaves no trace of the money it once described.";
  if (lower.includes("account")) return "Changing where money is sent, after the fact, is how a payment gets redirected.";
  if (lower.includes("waiv") || lower.includes("discount")) return "A waiver removes income without any cash moving, so it needs an approver.";
  if (lower.includes("void") || lower.includes("cancel")) return "Cancelling a receipt after collecting the money leaves the cash with no paper trail.";
  return "A change to the money records made after the fact needs a reason on file.";
}

/** The three-way match: the bank's feed, the bursary's ledger, and the parents' receipts. */
export function reconcileIncome(data: DemoData, now = new Date()) {
  const confirmed = data.payments.filter((payment) => payment.status === "CONFIRMED");
  const bankTotal = data.bankCredits.reduce((sum, credit) => sum + credit.amount, 0);
  const ledgerTotal = confirmed.reduce((sum, payment) => sum + payment.amount, 0);
  const parentTotal = data.parentConfirmations.reduce((sum, confirmation) => sum + confirmation.amount, 0);

  const days: { date: string; label: string; bank: number; ledger: number; parent: number; variance: number }[] = [];
  for (let index = 13; index >= 0; index -= 1) {
    const date = iso(addDays(now, -index));
    const bank = data.bankCredits.filter((credit) => credit.date === date).reduce((sum, credit) => sum + credit.amount, 0);
    const ledger = confirmed.filter((payment) => payment.paidAt === date).reduce((sum, payment) => sum + payment.amount, 0);
    const parent = data.parentConfirmations.filter((confirmation) => confirmation.paidOn === date).reduce((sum, confirmation) => sum + confirmation.amount, 0);
    days.push({ date, label: formatDate(date, now).slice(0, 6), bank, ledger, parent, variance: bank - ledger });
  }

  return {
    bankTotal,
    ledgerTotal,
    parentTotal,
    unmatchedBank: data.bankCredits.filter((credit) => credit.status !== "MATCHED"),
    missingFromLedger: data.parentConfirmations.filter((confirmation) => confirmation.status === "NOT_IN_LEDGER"),
    matched: data.bankCredits.filter((credit) => credit.status === "MATCHED").length,
    matchedRate: data.bankCredits.length ? Math.round((data.bankCredits.filter((credit) => credit.status === "MATCHED").length / data.bankCredits.length) * 100) : 100,
    days,
  };
}

/** Every naira the school cannot presently account for, itemised. */
export function exposureBreakdown(summary: IntegritySummary) {
  return [
    { label: "Income the bank or a parent can prove, but the books do not show", value: summary.hiddenIncome },
    { label: "Spent without the approval your policy requires", value: summary.unapprovedSpend },
  ];
}

