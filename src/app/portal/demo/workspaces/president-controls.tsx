"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleSlash,
  ClipboardCheck,
  Coins,
  FileSearch,
  FileWarning,
  Fingerprint,
  Flag,
  Gavel,
  HandCoins,
  Landmark,
  MessageSquareWarning,
  Receipt,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TrendingDown,
  Users,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, type BadgeTone } from "../ui";
import { formatDate, formatLongDate, naira } from "../format";
import { CONTROL_POLICY, SEVERITY_ORDER, reconcileIncome, type Finding, type IntegritySummary, type Severity } from "../integrity";
import type { Concern, DemoData, ExpenseApproval, PresidentAction } from "../types";

/**
 * The President's control centre: the money trail, the integrity findings and the
 * approval queue.
 *
 * She reads and decides here — approve, refuse, flag, question, escalate, close —
 * but she never types into a ledger. Every decision is written to an audit trail
 * of its own, so her office leaves the same mark on the record that it asks of
 * everybody else.
 */

export type ControlActions = {
  record: (kind: PresidentAction["kind"], targetType: string, targetId: string, summary: string, note?: string, amount?: number | null) => void;
  approve: (approval: ExpenseApproval) => void;
  reject: (approval: ExpenseApproval, reason: string) => void;
  query: (target: { targetType: string; targetId: string; summary: string; who: string; amount: number | null }) => void;
  setConcernStatus: (concern: Concern, status: Concern["status"]) => void;
};

const SEVERITY_TONE: Record<Severity, BadgeTone> = { CRITICAL: "red", HIGH: "orange", WATCH: "violet", CLEAN: "green" };
const SEVERITY_STRIPE: Record<Severity, string> = {
  CRITICAL: "border-rose-500",
  HIGH: "border-upwa-orange-500",
  WATCH: "border-upwa-blue-500",
  CLEAN: "border-upwa-green-600",
};
const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Needs you today",
  HIGH: "Needs an answer this week",
  WATCH: "Worth knowing",
  CLEAN: "Holding",
};

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const started = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - started) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/* ------------------------------- headline -------------------------------- */

function AssuranceDial({ value, held, total }: { value: number; held: number; total: number }) {
  const shown = useCountUp(value, 1200);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const tone = value >= 80 ? "#8FD3A6" : value >= 50 ? "#F6AE36" : "#FB7185";
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-black text-white">{shown}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-slate-300">of 100</span>
        <span className="mt-1 text-[10px] font-semibold text-upwa-orange-300">
          {held} of {total} controls holding
        </span>
      </div>
    </div>
  );
}

export function ControlHeadline({ summary }: { summary: IntegritySummary }) {
  const exposure = useCountUp(summary.exposure, 1300);
  const verdict =
    summary.assurance >= 80
      ? "Your money controls are holding. Nothing needs you today."
      : summary.assurance >= 50
        ? "Some controls are slipping. A few matters need your hand this week."
        : "Serious gaps in the money trail. Several matters need you today.";

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-upwa-midnight via-upwa-navy to-upwa-blue-900 px-6 py-7 text-white shadow-panel-lg sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-upwa-orange-500/10 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-7">
        <AssuranceDial value={summary.assurance} held={summary.controlsHeld} total={summary.controlsTotal} />
        <div className="min-w-[16rem] flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-upwa-orange-400">Integrity of the money trail</p>
          <h2 className="mt-1.5 font-display text-xl font-black leading-snug sm:text-2xl">{verdict}</h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-300">
            {summary.controlsTotal} controls ran over every naira the school received and spent this term. {summary.controlsHeld} are
            holding and {summary.controlsFailed} are not. Each failure below says what happened, what it puts at risk, and what to
            ask for next.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SEVERITY_ORDER.filter((level) => level !== "CLEAN").map((level) => (
              <span
                key={level}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 ring-inset ${
                  level === "CRITICAL"
                    ? "bg-rose-500/15 text-rose-200 ring-rose-400/40"
                    : level === "HIGH"
                      ? "bg-upwa-orange-500/15 text-upwa-orange-200 ring-upwa-orange-400/40"
                      : "bg-white/10 text-slate-200 ring-white/20"
                }`}
              >
                {summary.counts[level]} {SEVERITY_LABEL[level].toLowerCase()}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-upwa-green-600/20 px-3 py-1.5 text-[11px] font-bold text-upwa-green-200 ring-1 ring-inset ring-upwa-green-300/40">
              {summary.awaitingHer} awaiting your approval
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Siren, label: "Unaccounted for right now", value: naira(exposure), note: "Income nobody recorded, plus spending nobody approved", tone: "text-rose-200" },
          { icon: HandCoins, label: "Income the books do not show", value: naira(summary.hiddenIncome), note: "Proved by the bank or by a parent's own receipt", tone: "text-upwa-orange-200" },
          { icon: CircleSlash, label: "Spent without approval", value: naira(summary.unapprovedSpend), note: `Above the ${naira(CONTROL_POLICY.bursarApprovalCeiling)} limit, or approved by its own requester`, tone: "text-upwa-orange-200" },
        ].map((tile, index) => (
          <div
            key={tile.label}
            className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              <tile.icon size={14} className={tile.tone} /> {tile.label}
            </p>
            <p className="mt-2 font-display text-2xl font-black text-white">{tile.value}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">{tile.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- money trail ------------------------------ */

function ReconciliationBars({ bank, ledger, parent }: { bank: number; ledger: number; parent: number }) {
  const widest = Math.max(bank, ledger, parent, 1);
  const rows = [
    { label: "The bank's own feed", sub: "What actually arrived", value: bank, tone: "bg-upwa-blue-500", icon: Landmark },
    { label: "Parents' receipts", sub: "Sent automatically when they paid", value: parent, tone: "bg-upwa-orange-400", icon: Receipt },
    { label: "The bursary's ledger", sub: "What the school wrote down", value: ledger, tone: "bg-upwa-green-600", icon: Banknote },
  ];
  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div key={row.label} className="animate-fade-up" style={{ animationDelay: `${index * 90}ms` }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-bold text-upwa-navy">
              <row.icon size={15} className="text-slate-400" /> {row.label}
              <span className="text-[11px] font-medium text-slate-400">· {row.sub}</span>
            </p>
            <p className="font-display text-sm font-black text-upwa-navy">{naira(row.value)}</p>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${row.tone} transition-[width] duration-1000 ease-out`}
              style={{ width: `${Math.max(2, (row.value / widest) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptVerifier({ data }: { data: DemoData }) {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<null | { ok: boolean; lines: { label: string; value: string }[] }>(null);

  const verify = () => {
    const needle = term.trim().toLowerCase();
    if (!needle) return;
    const payment = data.payments.find(
      (item) => item.receiptNumber.toLowerCase() === needle || item.receiptNumber.toLowerCase().endsWith(needle) || item.reference.toLowerCase() === needle,
    );
    const confirmation = data.parentConfirmations.find((item) => item.receiptReference.toLowerCase().endsWith(needle));
    if (payment) {
      const credit = data.bankCredits.find((item) => item.matchedPaymentId === payment.id);
      setResult({
        ok: true,
        lines: [
          { label: "Receipt", value: payment.receiptNumber },
          { label: "Amount recorded", value: naira(payment.amount) },
          { label: "Recorded by", value: payment.recordedBy },
          { label: "Date", value: formatLongDate(payment.paidAt) },
          { label: "Status", value: payment.status.replace("_", " ").toLowerCase() },
          { label: "Seen in the bank feed", value: credit ? `Yes — ${credit.bank}, ${credit.reference}` : "Not yet" },
          { label: "Receipt sent to the parent", value: confirmation ? `Yes, by ${confirmation.channel.toLowerCase()}` : "No record of it" },
        ],
      });
      return;
    }
    if (confirmation) {
      setResult({
        ok: false,
        lines: [
          { label: "Receipt", value: confirmation.receiptReference },
          { label: "Amount", value: naira(confirmation.amount) },
          { label: "Sent to", value: `${confirmation.parentName} by ${confirmation.channel.toLowerCase()}` },
          { label: "In the school's ledger", value: "No — this is why it must be explained" },
        ],
      });
      return;
    }
    setResult({ ok: false, lines: [{ label: "Result", value: "No receipt, reference or parent confirmation carries that number." }] });
  };

  return (
    <div className="rounded-2xl border border-upwa-blue-200 bg-upwa-blue-50/60 p-4">
      <p className="flex items-center gap-2 text-[13px] font-bold text-upwa-navy">
        <Search size={15} className="text-upwa-blue-800" /> Check any receipt in one step
      </p>
      <p className="mt-1 text-[11px] leading-5 text-slate-600">
        This is the same check a parent can be given. Because the receipt went to the family automatically, nobody in the bursary
        can make a payment invisible by simply not writing it down.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && verify()}
          placeholder="RCP/2026-2027/0431 or a bank reference"
          className="min-w-[14rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
        />
        <Button size="sm" variant="primary" onClick={verify}>
          Check it
        </Button>
      </div>
      {result ? (
        <dl className="mt-3 space-y-1.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          {result.lines.map((line) => (
            <div key={line.label} className="flex flex-wrap justify-between gap-2 text-[11px]">
              <dt className="text-slate-500">{line.label}</dt>
              <dd className={`font-semibold ${result.ok ? "text-upwa-navy" : "text-rose-700"}`}>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function MoneyTrailView({ data, summary, recon, actions }: { data: DemoData; summary: IntegritySummary; recon: ReturnType<typeof reconcileIncome>; actions: ControlActions }) {
  const gap = recon.bankTotal - recon.ledgerTotal;
  const findings = summary.findings.filter((finding) => finding.group === "Money in" && !finding.resolved);
  const declarations = data.attestations.filter((entry) => entry.role === "BURSAR").slice(0, 7);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Three independent accounts of the same money"
          subtitle="The bank, the parents and the bursary each keep their own record. When they disagree, somebody is missing something."
          icon={<Scale size={18} />}
          action={<Badge tone={Math.abs(gap) < 1 ? "green" : "red"}>{gap === 0 ? "In agreement" : `${naira(Math.abs(gap))} apart`}</Badge>}
        />
        <ReconciliationBars bank={recon.bankTotal} ledger={recon.ledgerTotal} parent={recon.parentTotal} />
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] leading-6 text-slate-700">
            <span className="font-bold text-upwa-navy">What this says today: </span>
            the bank reports {naira(recon.bankTotal)} reaching the school, and parents were sent {naira(recon.parentTotal)} worth of
            receipts. The bursary's ledger shows {naira(recon.ledgerTotal)}.{" "}
            {gap > 0 ? (
              <>
                That leaves <span className="font-bold text-rose-700">{naira(gap)} that arrived and was never written down</span> —{" "}
                {recon.unmatchedBank.length} bank credit{recon.unmatchedBank.length === 1 ? "" : "s"} and{" "}
                {recon.missingFromLedger.length} parent receipt{recon.missingFromLedger.length === 1 ? "" : "s"} with no ledger entry
                behind {recon.missingFromLedger.length === 1 ? "it" : "them"}.
              </>
            ) : (
              "Every source agrees, so nothing is missing from the books today."
            )}
          </p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Bank credits with no receipt</p>
            <ul className="space-y-2">
              {recon.unmatchedBank.length ? (
                recon.unmatchedBank.map((credit) => (
                  <li key={credit.id} className="rounded-xl border-l-4 border-rose-500 bg-rose-50/60 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-bold text-upwa-navy">{naira(credit.amount)}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatDate(credit.date)} · {credit.channel.replace("_", " ").toLowerCase()}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-5 text-slate-600">
                      {credit.payerName} · {credit.bank}
                      {credit.reference ? ` · ref ${credit.reference}` : ""}
                    </p>
                    {credit.note ? <p className="mt-0.5 text-[11px] italic text-rose-700">{credit.note}</p> : null}
                  </li>
                ))
              ) : (
                <li className="rounded-xl border-l-4 border-upwa-green-600 bg-upwa-green-50 px-3.5 py-2.5 text-xs text-upwa-green-800">
                  Every credit the bank reported has a receipt behind it.
                </li>
              )}
            </ul>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Receipt books</p>
              <ul className="space-y-2">
                {data.receiptBooks.map((book) => {
                  const used = new Set(book.used);
                  const voided = new Set(book.voided.map((entry) => entry.number));
                  const missing: number[] = [];
                  for (let number = book.firstNumber; number <= book.lastNumber; number += 1) if (!used.has(number) && !voided.has(number)) missing.push(number);
                  return (
                    <li key={book.id} className={`rounded-xl border-l-4 px-3.5 py-2.5 ${missing.length ? "border-upwa-orange-500 bg-upwa-orange-50/70" : "border-upwa-green-600 bg-upwa-green-50"}`}>
                      <p className="text-xs font-bold text-upwa-navy">
                        {book.label} <span className="font-medium text-slate-500">· {book.heldBy}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-5 text-slate-600">
                        Numbers {book.firstNumber}–{book.lastNumber} · {book.used.length} used · {book.voided.length} cancelled
                        {missing.length ? (
                          <>
                            {" "}
                            · <span className="font-semibold text-rose-700">{missing.length} unaccounted for ({missing.slice(0, 6).join(", ")})</span>
                          </>
                        ) : (
                          <> · complete</>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <ReceiptVerifier data={data} />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Fourteen days of money in"
              subtitle="What the bank reported against what the ledger recorded, day by day"
              icon={<TrendingDown size={18} />}
            />
          </div>
          <div className="flex h-44 items-end gap-1.5 overflow-x-auto px-5 pb-5 sm:px-6">
            {recon.days.map((dayRow) => {
              const tallest = Math.max(...recon.days.map((item) => Math.max(item.bank, item.ledger)), 1);
              return (
                <div key={dayRow.date} className="group flex min-w-[1.6rem] flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1/2 rounded-t bg-upwa-blue-500/80 transition-all duration-700"
                      style={{ height: `${Math.max(2, (dayRow.bank / tallest) * 100)}%` }}
                      title={`Bank ${naira(dayRow.bank)}`}
                    />
                    <div
                      className={`w-1/2 rounded-t transition-all duration-700 ${dayRow.variance === 0 ? "bg-upwa-green-600/80" : "bg-rose-500"}`}
                      style={{ height: `${Math.max(2, (dayRow.ledger / tallest) * 100)}%` }}
                      title={`Ledger ${naira(dayRow.ledger)}`}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{dayRow.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-500 sm:px-6">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-upwa-blue-500/80" /> Bank feed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-upwa-green-600/80" /> Ledger, agreeing
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Ledger, short of the bank
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Daily declarations" subtitle="Who said the day's money was complete" icon={<ClipboardCheck size={18} />} />
          <ul className="space-y-2">
            {declarations.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
                {entry.status === "SIGNED" ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-upwa-green-600" />
                ) : entry.status === "VARIANCE" ? (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                ) : (
                  <XCircle size={15} className="mt-0.5 shrink-0 text-upwa-orange-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-upwa-navy">{formatDate(entry.date)}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    {entry.status === "OVERDUE" ? `${entry.signedBy} has not signed` : entry.note}
                  </p>
                  {entry.variance !== 0 ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-rose-700">
                      {entry.variance > 0 ? "Short" : "Over"} {naira(Math.abs(entry.variance))}
                    </p>
                  ) : null}
                </div>
                <Badge tone={entry.status === "SIGNED" ? "green" : entry.status === "VARIANCE" ? "red" : "orange"}>
                  {entry.status === "SIGNED" ? "Signed" : entry.status === "VARIANCE" ? "Variance" : "Overdue"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <FindingsFeed
        title="What the money trail turned up"
        subtitle="Every finding here is proved by a record the bursary did not write"
        findings={findings}
        actions={actions}
        icon={<FileSearch size={18} />}
      />
    </div>
  );
}

/* ------------------------------ findings feed ----------------------------- */

function FindingCard({ finding, actions }: { finding: Finding; actions: ControlActions }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`animate-fade-up overflow-hidden rounded-2xl border-l-4 bg-white shadow-panel ${SEVERITY_STRIPE[finding.severity]}`}>
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50">
        <span className="mt-0.5 shrink-0">
          {finding.severity === "CRITICAL" ? (
            <Siren size={17} className="text-rose-600" />
          ) : finding.severity === "HIGH" ? (
            <AlertTriangle size={17} className="text-upwa-orange-500" />
          ) : finding.severity === "WATCH" ? (
            <FileSearch size={17} className="text-upwa-blue-800" />
          ) : (
            <ShieldCheck size={17} className="text-upwa-green-600" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={SEVERITY_TONE[finding.severity]}>{finding.severity === "CLEAN" ? "Holding" : finding.severity}</Badge>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{finding.group}</span>
            {finding.amount ? <span className="font-display text-xs font-black text-upwa-navy">{naira(finding.amount)}</span> : null}
            {finding.resolved ? <Badge tone="green">Closed by you</Badge> : null}
          </span>
          <span className="mt-1.5 block font-display text-sm font-bold leading-snug text-upwa-navy">{finding.title}</span>
          <span className="mt-1 block text-[12px] leading-5 text-slate-600">{finding.plainWords}</span>
          <span className="mt-1.5 block text-[11px] text-slate-400">
            {finding.who} · {finding.when} · {open ? "hide the detail" : "show the detail and what to do"}
          </span>
        </span>
      </button>
      {open ? (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
          <p className="text-[12px] leading-6 text-slate-700">
            <span className="font-bold text-upwa-navy">Why it matters: </span>
            {finding.whatItMeans}
          </p>
          <dl className="mt-3 space-y-1.5">
            {finding.evidence.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-3 py-2 text-[11px] ring-1 ring-slate-200">
                <dt className="min-w-[9rem] text-slate-500">{row.label}</dt>
                <dd className="flex-1 text-right font-semibold text-upwa-navy">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl border border-upwa-orange-200 bg-upwa-orange-50 px-3.5 py-2.5 text-[12px] leading-5 text-upwa-orange-800">
            <span className="font-bold">What to ask for: </span>
            {finding.action}
          </p>
          {finding.allows.length && !finding.resolved ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {finding.allows.map((kind) => (
                <Button
                  key={kind}
                  size="sm"
                  variant={kind === "ESCALATE" || kind === "REJECT" ? "danger" : kind === "QUERY" ? "primary" : "ghost"}
                  icon={<ActionIcon kind={kind} />}
                  onClick={() => {
                    if (kind === "QUERY") {
                      actions.query({ targetType: finding.targetType, targetId: finding.targetId, summary: finding.title, who: finding.who, amount: finding.amount });
                      return;
                    }
                    actions.record(kind, finding.targetType, finding.targetId, finding.title, "", finding.amount);
                  }}
                >
                  {ACTION_LABEL[kind]}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

const ACTION_LABEL: Record<PresidentAction["kind"], string> = {
  APPROVE: "Approve",
  REJECT: "Refuse",
  FLAG: "Flag it",
  QUERY: "Ask for an explanation",
  ESCALATE: "Escalate to the board",
  RESOLVE: "Mark it closed",
  ATTEST: "Sign it off",
  VERIFY: "Verified",
};

function ActionIcon({ kind }: { kind: PresidentAction["kind"] }) {
  const size = 14;
  if (kind === "APPROVE") return <BadgeCheck size={size} />;
  if (kind === "REJECT") return <XCircle size={size} />;
  if (kind === "FLAG") return <Flag size={size} />;
  if (kind === "QUERY") return <MessageSquareWarning size={size} />;
  if (kind === "ESCALATE") return <Siren size={size} />;
  if (kind === "RESOLVE") return <CheckCircle2 size={size} />;
  if (kind === "ATTEST") return <ClipboardCheck size={size} />;
  return <ShieldCheck size={size} />;
}

export function FindingsFeed({ title, subtitle, findings, actions, icon }: { title: string; subtitle: string; findings: Finding[]; actions: ControlActions; icon?: React.ReactNode }) {
  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader title={title} subtitle={subtitle} icon={icon ?? <ShieldAlert size={18} />} action={<Badge tone="navy">{findings.length} item{findings.length === 1 ? "" : "s"}</Badge>} />
      </div>
      {findings.length ? (
        <ul className="space-y-3 px-5 pb-5 sm:px-6">
          {findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} actions={actions} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-slate-100 px-5 py-6 text-center text-sm text-slate-500 sm:px-6">
          Nothing here needs you. Every control in this area is holding.
        </p>
      )}
    </Card>
  );
}

/* -------------------------------- integrity ------------------------------- */

export function IntegrityView({ data, summary, actions }: { data: DemoData; summary: IntegritySummary; actions: ControlActions }) {
  const [group, setGroup] = useState<"All" | Finding["group"]>("All");
  const shown = useMemo(
    () => summary.findings.filter((finding) => finding.group !== "Money in" && (group === "All" || finding.group === group)),
    [summary.findings, group],
  );
  const groups: ("All" | Finding["group"])[] = ["All", "Money out", "Payroll", "Governance"];

  return (
    <div className="space-y-5">
      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="The control register"
            subtitle={`Every control that runs over the school's money, and whether it held today · ${summary.controlsHeld} of ${summary.controlsTotal} holding`}
            icon={<Fingerprint size={18} />}
          />
        </div>
        <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {summary.register.map((entry, index) => (
            <li
              key={entry.control.id}
              className={`animate-fade-up flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                entry.status === "CLEAN" ? "border-upwa-green-200 bg-upwa-green-50" : entry.status === "CRITICAL" ? "border-rose-200 bg-rose-50" : entry.status === "HIGH" ? "border-upwa-orange-200 bg-upwa-orange-50" : "border-slate-200 bg-white"
              }`}
              style={{ animationDelay: `${index * 35}ms` }}
            >
              {entry.status === "CLEAN" ? (
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-upwa-green-600" />
              ) : (
                <ShieldAlert size={15} className={`mt-0.5 shrink-0 ${entry.status === "CRITICAL" ? "text-rose-600" : entry.status === "HIGH" ? "text-upwa-orange-500" : "text-slate-400"}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-4 text-upwa-navy">{entry.control.label}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                  {entry.control.group} · {entry.status === "CLEAN" ? "holding" : `${entry.findings.length} finding${entry.findings.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {groups.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGroup(option)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${
              group === option ? "bg-upwa-navy text-white shadow-panel" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {option}
            <span className="ml-1.5 opacity-70">
              {option === "All" ? summary.findings.filter((finding) => finding.group !== "Money in").length : summary.findings.filter((finding) => finding.group === option).length}
            </span>
          </button>
        ))}
      </div>

      <FindingsFeed
        title="Everything else the controls turned up"
        subtitle="Spending, payroll and the way the records themselves were handled"
        findings={shown}
        actions={actions}
        icon={<Gavel size={18} />}
      />
    </div>
  );
}

/* -------------------------------- oversight ------------------------------- */

/** The confidential line and the record of every change made to the books. */
export function OversightView({ data, actions }: { data: DemoData; actions: ControlActions }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Concerns people have raised"
              subtitle="The confidential line, parents and staff — and whether they were answered"
              icon={<MessageSquareWarning size={18} />}
            />
          </div>
          <ul className="space-y-3 px-5 pb-5 sm:px-6">
            {data.concerns.map((concern) => (
              <li key={concern.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={concern.status === "RESOLVED" ? "green" : concern.status === "INVESTIGATING" ? "orange" : "red"}>
                    {concern.status.replace("_", " ").toLowerCase()}
                  </Badge>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {concern.channel.replace("_", " ").toLowerCase()}
                  </span>
                  {concern.amount ? <span className="font-display text-xs font-black text-upwa-navy">{naira(concern.amount)}</span> : null}
                </div>
                <p className="mt-2 text-[13px] font-bold leading-snug text-upwa-navy">{concern.subject}</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-600">{concern.body}</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  {concern.anonymous ? "Raised anonymously" : concern.raisedBy} · {formatDate(concern.raisedAt.slice(0, 10))}
                </p>
                {concern.response ? (
                  <p className="mt-2 rounded-xl bg-upwa-green-50 px-3 py-2 text-[11px] leading-5 text-upwa-green-800">Your office replied: {concern.response}</p>
                ) : null}
                {concern.status !== "RESOLVED" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<MessageSquareWarning size={14} />}
                      onClick={() => actions.setConcernStatus(concern, "INVESTIGATING")}
                      disabled={concern.status === "INVESTIGATING"}
                    >
                      Open an investigation
                    </Button>
                    <Button size="sm" variant="ghost" icon={<CheckCircle2 size={14} />} onClick={() => actions.setConcernStatus(concern, "RESOLVED")}>
                      Close with an answer
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Changes made to the records"
              subtitle="Every edit, cancellation and re-dating, with the name against it"
              icon={<FileWarning size={18} />}
            />
          </div>
          <ul className="space-y-2 px-5 pb-5 sm:px-6">
            {data.auditLog.slice(0, 12).map((entry) => (
              <li
                key={entry.id}
                className={`rounded-xl border-l-4 px-3.5 py-2.5 ${
                  entry.severity === "ALERT" ? "border-rose-500 bg-rose-50/60" : entry.severity === "WATCH" ? "border-upwa-orange-400 bg-upwa-orange-50/60" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-upwa-navy">{entry.action}</p>
                  <p className="text-[10px] text-slate-400">{new Date(entry.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">{entry.detail}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {entry.actor}
                  {entry.amount ? ` · ${naira(entry.amount)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------- approvals ------------------------------- */

export function ApprovalsView({ data, summary, actions }: { data: DemoData; summary: IntegritySummary; actions: ControlActions }) {
  const [reason, setReason] = useState<Record<string, string>>({});
  const pending = data.expenseApprovals.filter((entry) => entry.status === "PENDING");
  const unauthorised = data.expenseApprovals.filter((entry) => entry.status === "PAID_WITHOUT_APPROVAL");
  const selfApproved = data.expenseApprovals.filter((entry) => entry.approvedBy && entry.requestedBy === entry.approvedBy);

  const vendorTotals = useMemo(() => {
    const totals = new Map<string, { vendor: string; paid: number; count: number; last: string }>();
    data.expenseApprovals
      .filter((entry) => entry.paidAt)
      .forEach((entry) => {
        const existing = totals.get(entry.vendor);
        totals.set(entry.vendor, {
          vendor: entry.vendor,
          paid: (existing?.paid ?? 0) + entry.amount,
          count: (existing?.count ?? 0) + 1,
          last: existing ? (existing.last > entry.date ? existing.last : entry.date) : entry.date,
        });
      });
    return [...totals.values()].sort((a, b) => b.paid - a.paid).slice(0, 8);
  }, [data.expenseApprovals]);

  const grandTotal = vendorTotals.reduce((sum, entry) => sum + entry.paid, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Waiting for your decision"
              subtitle={`Nothing above ${naira(CONTROL_POLICY.bursarApprovalCeiling)} can be paid until you approve or refuse it`}
              icon={<Gavel size={18} />}
              action={<Badge tone="navy">{pending.length} request{pending.length === 1 ? "" : "s"}</Badge>}
            />
          </div>
          <ul className="space-y-3 px-5 pb-5 sm:px-6">
            {pending.length ? (
              pending.map((approval) => (
                <li key={approval.id} className="animate-fade-up rounded-2xl border border-upwa-orange-200 bg-upwa-orange-50/50 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-base font-black text-upwa-navy">{naira(approval.amount)}</p>
                    <Badge tone={approval.amount >= CONTROL_POLICY.presidentApprovalFloor ? "red" : "orange"}>
                      {approval.amount >= CONTROL_POLICY.presidentApprovalFloor ? "Only you may approve this" : "Above the bursar's limit"}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[13px] font-bold leading-snug text-upwa-navy">{approval.description}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {approval.vendor} · {approval.category} · asked by {approval.requestedBy} on {formatDate(approval.date)}
                  </p>
                  <p className={`mt-1.5 text-[11px] ${approval.evidence ? "text-upwa-green-800" : "text-rose-700"}`}>
                    {approval.evidenceNote}
                  </p>
                  {!approval.evidence && approval.amount >= CONTROL_POLICY.presidentApprovalFloor ? (
                    <p className="mt-1.5 rounded-lg bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
                      Policy needs two written quotes above {naira(CONTROL_POLICY.presidentApprovalFloor)}. Refuse it until they are attached.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="primary" icon={<BadgeCheck size={14} />} onClick={() => actions.approve(approval)}>
                      Approve
                    </Button>
                    <input
                      value={reason[approval.id] ?? ""}
                      onChange={(event) => setReason((current) => ({ ...current, [approval.id]: event.target.value }))}
                      placeholder="Reason for refusing (it is recorded)"
                      className="min-w-[12rem] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    />
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<XCircle size={14} />}
                      onClick={() => actions.reject(approval, reason[approval.id]?.trim() || "No reason given")}
                    >
                      Refuse
                    </Button>
                  </div>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-upwa-green-200 bg-upwa-green-50 px-4 py-6 text-center text-sm text-upwa-green-800">
                Nothing is waiting on you. The bursary is working inside its limits.
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Your spending limits" subtitle="The rulebook these pages enforce" icon={<Scale size={18} />} />
          <ul className="space-y-2.5">
            {[
              { label: "Bursar may approve up to", value: naira(CONTROL_POLICY.bursarApprovalCeiling), note: "Above this, payment waits for you" },
              { label: "Only you may approve above", value: naira(CONTROL_POLICY.presidentApprovalFloor), note: "Two written quotes required" },
              { label: "Cash taken at the counter", value: naira(CONTROL_POLICY.cashCeiling), note: "Above this it must reach the bank the same day" },
              { label: "Transfers confirmed within", value: `${CONTROL_POLICY.pendingReviewDays} days`, note: "Or they appear here as a finding" },
              { label: "Critical matters escalated after", value: `${CONTROL_POLICY.escalationHours} hours`, note: "To the executive board" },
              { label: "Split purchases tested over", value: `${CONTROL_POLICY.splitWindowDays} days`, note: "Three or more payments to one vendor" },
            ].map((row) => (
              <li key={row.label} className="rounded-xl border border-slate-200 px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-600">{row.label}</p>
                  <p className="font-display text-xs font-black text-upwa-navy">{row.value}</p>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{row.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <FindingsFeed
        title="Spending that broke the rules"
        subtitle="Paid without approval, split to avoid your limit, duplicated, or approved by its own requester"
        findings={summary.findings.filter((finding) => ["PAID_WITHOUT_APPROVAL", "SPLIT_PURCHASE", "DUPLICATE_PAYMENT", "SELF_APPROVED", "NO_EVIDENCE"].includes(finding.code) && !finding.resolved)}
        actions={actions}
        icon={<CircleSlash size={18} />}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader title="Where the money is going" subtitle="The eight suppliers paid most this term" icon={<Coins size={18} />} />
          </div>
          <ul className="space-y-2 px-5 pb-5 sm:px-6">
            {vendorTotals.map((entry) => (
              <li key={entry.vendor} className="rounded-xl border border-slate-200 px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-upwa-navy">{entry.vendor}</p>
                  <p className="font-display text-xs font-black text-upwa-navy">{naira(entry.paid)}</p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-upwa-blue-500 to-upwa-orange-400 transition-[width] duration-1000"
                    style={{ width: `${Math.max(3, (entry.paid / (vendorTotals[0]?.paid ?? 1)) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {entry.count} payment{entry.count === 1 ? "" : "s"} · {Math.round((entry.paid / Math.max(1, grandTotal)) * 100)}% of the top eight · last paid {formatDate(entry.last)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card padded={false}>
            <div className="p-5 sm:p-6">
              <CardHeader title="Budgets against spending" subtitle="What you allowed for the term, and what has gone" icon={<TrendingDown size={18} />} />
            </div>
            <ul className="space-y-2.5 px-5 pb-5 sm:px-6">
              {data.budgets.map((budget) => {
                const spent = data.expenses.filter((expense) => expense.category === budget.category).reduce((sum, expense) => sum + expense.amount, 0);
                const share = budget.allocated ? spent / budget.allocated : 0;
                return (
                  <li key={budget.id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-600">{budget.category}</p>
                      <p className="text-[11px] font-bold text-upwa-navy">
                        {naira(spent)} <span className="font-medium text-slate-400">of {naira(budget.allocated)}</span>
                      </p>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-[width] duration-1000 ${share > 1 ? "bg-rose-500" : share > 0.85 ? "bg-upwa-orange-400" : "bg-upwa-green-600"}`}
                        style={{ width: `${Math.min(100, Math.max(2, share * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {(unauthorised.length || selfApproved.length) && (
            <Card className="border-rose-200 bg-rose-50/50">
              <CardHeader title="Already paid, against the rules" subtitle="These cannot be stopped now — only recovered and explained" icon={<ShieldAlert size={18} />} />
              <ul className="space-y-2">
                {[...unauthorised, ...selfApproved].map((entry) => (
                  <li key={`${entry.id}-${entry.status}`} className="rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-rose-200">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-bold text-upwa-navy">{entry.description}</p>
                      <p className="font-display text-xs font-black text-rose-700">{naira(entry.amount)}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {entry.vendor} · {formatDate(entry.date)} ·{" "}
                      <span className="font-semibold text-rose-700">
                        {entry.status === "PAID_WITHOUT_APPROVAL" ? "paid without approval" : "approved by its own requester"}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <FindingsFeed
        title="Payroll assurance"
        subtitle="Everyone paid, against everyone who actually works here"
        findings={summary.findings.filter((finding) => finding.group === "Payroll" && !finding.resolved)}
        actions={actions}
        icon={<Users size={18} />}
      />

      <Card>
        <CardHeader
          title="Staff on the payroll"
          subtitle={`${data.staff.filter((member) => member.status === "ACTIVE").length} active, ${data.staff.filter((member) => member.status === "ON_LEAVE").length} on approved leave, ${data.staff.filter((member) => member.status === "RESIGNED").length} resigned`}
          icon={<Users size={18} />}
        />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.staff
            .filter((member) => member.status !== "ACTIVE")
            .map((member) => (
              <li key={member.id} className={`rounded-xl border-l-4 px-3.5 py-2.5 ${member.status === "RESIGNED" ? "border-rose-500 bg-rose-50/60" : "border-upwa-orange-400 bg-upwa-orange-50/60"}`}>
                <p className="text-xs font-bold text-upwa-navy">
                  {member.title} {member.firstName} {member.lastName}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {member.staffNumber} · {member.role.replace("_", " ").toLowerCase()}
                </p>
                <p className={`mt-1 text-[11px] font-semibold ${member.status === "RESIGNED" ? "text-rose-700" : "text-upwa-orange-800"}`}>
                  {member.status === "RESIGNED" ? "Has left — must not appear on the next payroll run" : "On approved leave — still paid"}
                </p>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------ her decisions ----------------------------- */

export function DecisionTrail({ data }: { data: DemoData }) {
  if (!data.presidentActions.length) {
    return (
      <Card className="border-dashed">
        <p className="text-center text-[13px] leading-6 text-slate-500">
          <Banknote size={16} className="mx-auto mb-2 text-slate-300" />
          Nothing has been decided from this office yet. Every approval, refusal, question and escalation you make is written here —
          with the time and your reason — so the trail of decisions is as complete as the trail of money.
        </p>
      </Card>
    );
  }
  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader title="Your decisions" subtitle="Recorded the moment you make them, and never edited afterwards" icon={<ClipboardCheck size={18} />} action={<Badge tone="navy">{data.presidentActions.length}</Badge>} />
      </div>
      <ul className="space-y-2 px-5 pb-5 sm:px-6">
        {data.presidentActions.slice(0, 14).map((action) => (
          <li key={action.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="mt-0.5 shrink-0">
              <ActionIcon kind={action.kind} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-upwa-navy">
                {ACTION_LABEL[action.kind]} · {action.summary}
              </p>
              {action.note ? <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{action.note}</p> : null}
              <p className="mt-0.5 text-[10px] text-slate-400">
                {new Date(action.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                {action.amount ? ` · ${naira(action.amount)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
