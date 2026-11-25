"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
  FileSpreadsheet,
  Receipt,
  ReceiptText,
  TrendingUp,
  Wallet,
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
  Select,
  StatCard,
  StatusBadge,
  TabBar,
  inputClass,
  type Column,
} from "../ui";
import { SchemaForm, blankFrom, coerceFrom, type FieldSchema, type FormValues } from "../form";
import type { Invoice, Payment, PaymentMethod } from "../types";
import {
  compactNaira,
  confirmedPayments,
  formatDate,
  fullName,
  invoiceStatus,
  invoiceTotal,
  methodLabel,
  naira,
  termLabel,
} from "../format";

const BANKS = [
  "Zenith Bank",
  "Guaranty Trust Bank",
  "First Bank of Nigeria",
  "Access Bank",
  "United Bank for Africa",
  "Sterling Bank",
  "Wema Bank",
  "Paystack (card / transfer)",
  "School bursary",
];

export function FinanceWorkspace() {
  const { data, create, update, remove, updateSettings, notify } = useDemo();
  const [tab, setTab] = useState("invoices");
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [payingFor, setPayingFor] = useState<Invoice | null>(null);
  const [paymentValues, setPaymentValues] = useState<FormValues>({});
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null);
  const [editingFee, setEditingFee] = useState<string | null>(null);
  const [feeValues, setFeeValues] = useState<FormValues>({});

  const students = data?.students ?? [];
  const invoices = data?.invoices ?? [];
  const payments = data?.payments ?? [];

  const studentOf = (studentId: string) => students.find((student) => student.id === studentId);

  const enriched = useMemo(
    () =>
      invoices.map((invoice) => {
        const total = invoiceTotal(invoice);
        const paid = confirmedPayments(payments, invoice.id);
        return {
          invoice,
          total,
          paid,
          balance: Math.max(0, total - paid),
          status: invoiceStatus(invoice, payments),
          student: studentOf(invoice.studentId),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, payments, students],
  );

  if (!data) return null;
  const { settings } = data;

  const billed = enriched.reduce((sum, row) => sum + row.total, 0);
  const collected = payments.filter((payment) => payment.status === "CONFIRMED").reduce((sum, payment) => sum + payment.amount, 0);
  const awaitingReview = payments.filter((payment) => payment.status === "PENDING_REVIEW");
  const outstanding = Math.max(0, billed - collected);
  const collectionRate = billed ? Math.round((collected / billed) * 100) : 0;

  const paymentSchema: FieldSchema[] = [
    { name: "amount", label: "Amount received (₦)", type: "number", required: true, min: 0, step: 500 },
    { name: "method", label: "Payment method", type: "select", required: true, options: ["BANK_TRANSFER", "PAYSTACK", "CASH_BURSARY"].map((value) => ({ value, label: methodLabel(value) })) },
    { name: "bank", label: "Bank / channel", type: "select", options: BANKS },
    { name: "reference", label: "Bank reference or teller number", placeholder: "TRF/000123456" },
    { name: "paidAt", label: "Value date", type: "date", required: true },
    { name: "status", label: "Bursary review", type: "select", options: [
      { value: "CONFIRMED", label: "Confirmed against statement" },
      { value: "PENDING_REVIEW", label: "Pending review (evidence uploaded)" },
      { value: "REJECTED", label: "Rejected — could not be traced" },
    ] },
  ];

  function openPay(invoice: Invoice) {
    const row = enriched.find((item) => item.invoice.id === invoice.id);
    setPaymentValues(
      blankFrom(paymentSchema, {
        amount: row?.balance ?? invoiceTotal(invoice),
        method: "BANK_TRANSFER",
        bank: BANKS[0],
        paidAt: new Date().toISOString().slice(0, 10),
        status: "CONFIRMED",
      }),
    );
    setPayingFor(invoice);
    setEditingPayment(null);
  }

  function submitPayment() {
    if (!payingFor) return;
    const next = coerceFrom(paymentSchema, paymentValues);
    const method = String(next.method) as PaymentMethod;
    create("payments", {
      receiptNumber: `RCP/${settings.session.replace("/", "-")}/${String(payments.length + 421).padStart(4, "0")}`,
      invoiceId: payingFor.id,
      studentId: payingFor.studentId,
      amount: Number(next.amount) || 0,
      method,
      reference: String(next.reference) || (method === "CASH_BURSARY" ? `CASH-BUR-${payments.length + 100}` : `TRF/${String(Date.now()).slice(-9)}`),
      bank: String(next.bank),
      status: next.status as Payment["status"],
      paidAt: String(next.paidAt),
      recordedBy: "Mrs. Grace Ameh (Bursary)",
    });
    notify("Payment recorded", "success", `${naira(Number(next.amount))} — ${studentOf(payingFor.studentId)?.firstName ?? "Pupil"}`);
    setPayingFor(null);
    setViewing(null);
  }

  function editPayment(payment: Payment) {
    setPaymentValues({
      amount: payment.amount,
      method: payment.method,
      bank: payment.bank,
      reference: payment.reference,
      paidAt: payment.paidAt,
      status: payment.status,
    });
    setEditingPayment(payment);
    setPayingFor(invoices.find((invoice) => invoice.id === payment.invoiceId) ?? null);
  }

  function submitPaymentEdit() {
    if (!editingPayment) return;
    const next = coerceFrom(paymentSchema, paymentValues);
    update("payments", editingPayment.id, next as unknown as Partial<Payment>);
    notify("Payment updated", "success", `${editingPayment.receiptNumber} — ${naira(Number(next.amount))}`);
    setEditingPayment(null);
    setPayingFor(null);
  }

  const invoiceColumns: Column<(typeof enriched)[number]>[] = [
    {
      key: "pupil",
      header: "Pupil",
      sortValue: (row) => (row.student ? `${row.student.lastName} ${row.student.firstName}` : "zzz"),
      searchValue: (row) => `${row.student ? fullName(row.student) : ""} ${row.invoice.invoiceNumber}`,
      render: (row) =>
        row.student ? (
          <div className="flex items-center gap-3">
            <Avatar name={`${row.student.firstName} ${row.student.lastName}`} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{row.student.lastName}, {row.student.firstName}</p>
              <p className="truncate text-[11px] text-slate-500">{row.student.className} {row.student.arm}</p>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">Pupil removed</span>
        ),
    },
    { key: "invoice", header: "Invoice", hideBelow: "md", render: (row) => <span className="font-mono text-[11px] text-slate-600">{row.invoice.invoiceNumber}</span> },
    { key: "total", header: "Billed", align: "right", sortValue: (row) => row.total, render: (row) => <span className="font-semibold text-slate-800">{naira(row.total)}</span> },
    { key: "paid", header: "Received", align: "right", hideBelow: "sm", sortValue: (row) => row.paid, render: (row) => <span className="text-upwa-green-700">{naira(row.paid)}</span> },
    { key: "balance", header: "Balance", align: "right", sortValue: (row) => row.balance, render: (row) => (
      <span className={`font-semibold ${row.balance > 0 ? "text-rose-600" : "text-slate-400"}`}>{row.balance > 0 ? naira(row.balance) : "—"}</span>
    ) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
  ];

  const paymentColumns: Column<Payment>[] = [
    {
      key: "receipt",
      header: "Receipt",
      sortValue: (row) => row.receiptNumber,
      searchValue: (row) => `${row.receiptNumber} ${row.reference} ${row.bank} ${studentOf(row.studentId) ? fullName(studentOf(row.studentId)!) : ""}`,
      render: (row) => (
        <div>
          <p className="font-mono text-[11px] font-semibold text-slate-800">{row.receiptNumber}</p>
          <p className="font-mono text-[10px] text-slate-500">{row.reference}</p>
        </div>
      ),
    },
    {
      key: "pupil",
      header: "Pupil",
      sortValue: (row) => studentOf(row.studentId)?.lastName ?? "zzz",
      render: (row) => {
        const student = studentOf(row.studentId);
        return student ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={`${student.firstName} ${student.lastName}`} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{student.lastName}, {student.firstName}</p>
              <p className="text-[11px] text-slate-500">{student.className} {student.arm}</p>
            </div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    { key: "amount", header: "Amount", align: "right", sortValue: (row) => row.amount, render: (row) => <span className="font-display text-sm font-bold text-upwa-navy">{naira(row.amount)}</span> },
    { key: "method", header: "Channel", hideBelow: "md", render: (row) => (
      <div>
        <p className="text-slate-800">{methodLabel(row.method)}</p>
        <p className="text-[11px] text-slate-500">{row.bank}</p>
      </div>
    ) },
    { key: "date", header: "Value date", hideBelow: "lg", sortValue: (row) => row.paidAt, render: (row) => <span className="text-slate-600">{formatDate(row.paidAt)}</span> },
    { key: "status", header: "Review", render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Billed · ${termLabel(settings.currentTerm)}`} value={compactNaira(billed)} note={`${invoices.length} invoices raised`} icon={<FileSpreadsheet size={19} />} />
        <StatCard label="Collected" value={compactNaira(collected)} note={`${payments.filter((p) => p.status === "CONFIRMED").length} confirmed payments`} icon={<Wallet size={19} />} tone="green" />
        <StatCard label="Outstanding" value={compactNaira(outstanding)} note={`${enriched.filter((row) => row.balance > 0).length} families with a balance`} icon={<CircleDollarSign size={19} />} tone="orange" />
        <StatCard label="Collection rate" value={`${collectionRate}%`} note={`${awaitingReview.length} payment(s) awaiting bursary review`} icon={<TrendingUp size={19} />} tone="violet" />
      </div>

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "invoices", label: "Invoices", count: invoices.length },
          { key: "payments", label: "Payments", count: payments.length },
          { key: "review", label: "Awaiting review", count: awaitingReview.length },
          { key: "structure", label: "Fee structure" },
        ]}
      />

      {tab === "invoices" ? (
        <DataTable
          rows={enriched}
          columns={invoiceColumns}
          getId={(row) => row.invoice.id}
          title="Term invoices"
          subtitle={`${settings.session} · ${termLabel(settings.currentTerm)} · generated from the fee structure`}
          searchPlaceholder="Search pupil or invoice number…"
          onView={(row) => setViewing(row.invoice)}
          onDelete={(row) => setPendingInvoice(row.invoice)}
          pageSize={8}
        />
      ) : null}

      {tab === "payments" ? (
        <DataTable
          rows={payments}
          columns={paymentColumns}
          getId={(row) => row.id}
          title="Payment ledger"
          subtitle="Every receipt raised by the bursary, including bank transfers awaiting confirmation."
          searchPlaceholder="Search receipt, reference or pupil…"
          onView={(row) => {
            const invoice = invoices.find((item) => item.id === row.invoiceId);
            if (invoice) setViewing(invoice);
          }}
          onEdit={editPayment}
          onDelete={setPendingPayment}
          pageSize={8}
        />
      ) : null}

      {tab === "review" ? (
        <Card>
          <CardHeader
            title="Bank transfers awaiting confirmation"
            subtitle="Families upload transfer evidence; the bursary matches it against the bank statement before confirming."
            icon={<Banknote size={18} />}
            action={<Badge tone={awaitingReview.length ? "orange" : "green"}>{awaitingReview.length} pending</Badge>}
          />
          {awaitingReview.length === 0 ? (
            <p className="rounded-xl bg-upwa-green-50 px-4 py-8 text-center text-sm text-upwa-green-800">
              Nothing to review — every uploaded transfer has been reconciled.
            </p>
          ) : (
            <ul className="space-y-3">
              {awaitingReview.map((payment) => {
                const student = studentOf(payment.studentId);
                return (
                  <li key={payment.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 p-4">
                    <Avatar name={student ? `${student.firstName} ${student.lastName}` : "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{student ? fullName(student) : "Unknown pupil"}</p>
                      <p className="truncate text-[11px] text-slate-500">
                        {naira(payment.amount)} · {payment.bank} · ref {payment.reference} · {formatDate(payment.paidAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => {
                          update("payments", payment.id, { status: "CONFIRMED" });
                          notify("Transfer confirmed", "success", `${naira(payment.amount)} matched to ${payment.receiptNumber}.`);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="dangerOutline"
                        onClick={() => {
                          update("payments", payment.id, { status: "REJECTED" });
                          notify("Transfer rejected", "danger", "The family will be notified to re-upload evidence.");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "structure" ? (
        <Card>
          <CardHeader
            title="Fee structure"
            subtitle={`Amounts charged per term. Editing these updates how new invoices are calculated for each level.`}
            icon={<ReceiptText size={18} />}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3 text-right">Tuition</th>
                  <th className="px-4 py-3 text-right">Levies</th>
                  <th className="px-4 py-3 text-right">Feeding</th>
                  <th className="px-4 py-3 text-right">Total per term</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings.fees.map((row) => {
                  const total = row.tuition + row.levies + row.feeding;
                  const editing = editingFee === row.id;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-upwa-canvas/50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.level}</td>
                      {(["tuition", "levies", "feeding"] as const).map((field) => (
                        <td key={field} className="px-4 py-3 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              step={500}
                              aria-label={`${field} for ${row.level}`}
                              value={String(feeValues[field] ?? row[field])}
                              onChange={(event) => setFeeValues((current) => ({ ...current, [field]: event.target.value === "" ? 0 : Number(event.target.value) }))}
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm outline-none focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
                            />
                          ) : (
                            <span className="text-slate-700">{naira(row[field])}</span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-display font-bold text-upwa-navy">
                        {editing ? naira((Number(feeValues.tuition) || 0) + (Number(feeValues.levies) || 0) + (Number(feeValues.feeding) || 0)) : naira(total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {editing ? (
                            <>
                              <Button size="sm" variant="primary" onClick={() => {
                                updateSettings({
                                  fees: settings.fees.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          tuition: Number(feeValues.tuition) || 0,
                                          levies: Number(feeValues.levies) || 0,
                                          feeding: Number(feeValues.feeding) || 0,
                                        }
                                      : item,
                                  ),
                                });
                                setEditingFee(null);
                                notify("Fee structure updated", "success", `${row.level} now bills ${naira((Number(feeValues.tuition) || 0) + (Number(feeValues.levies) || 0) + (Number(feeValues.feeding) || 0))} per term.`);
                              }}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingFee(null)}>Cancel</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setEditingFee(row.id); setFeeValues({ tuition: row.tuition, levies: row.levies, feeding: row.feeding }); }}>
                              Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 rounded-xl bg-upwa-blue-50 px-4 py-3 text-xs leading-5 text-upwa-blue-900">
            Invoices itemise tuition, the development levy, PTA dues, the examination and ICT levy, and feeding where the
            level offers a lunch plan — the same breakdown parents see on the family portal.
          </p>
        </Card>
      ) : null}

      {/* Invoice detail */}
      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        size="md"
        title="Invoice"
        subtitle={viewing?.invoiceNumber}
        footer={
          viewing ? (
            <>
              <Button variant="dangerOutline" onClick={() => { setPendingInvoice(viewing); setViewing(null); }}>Delete invoice</Button>
              <Button variant="primary" icon={<Receipt size={15} />} onClick={() => openPay(viewing)}>Record a payment</Button>
            </>
          ) : null
        }
      >
        {viewing ? (() => {
          const row = enriched.find((item) => item.invoice.id === viewing.id);
          const student = studentOf(viewing.studentId);
          const invoicePayments = payments.filter((payment) => payment.invoiceId === viewing.id);
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl bg-upwa-canvas p-4">
                <Avatar name={student ? `${student.firstName} ${student.lastName}` : "?"} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold text-upwa-navy">{student ? fullName(student) : "Pupil removed"}</p>
                  <p className="text-xs text-slate-600">{student ? `${student.className} ${student.arm} · ${student.admissionNumber}` : ""}</p>
                </div>
                <div className="ml-auto">{row ? <StatusBadge status={row.status} /> : null}</div>
              </div>

              <dl>
                <DetailRow label="Session and term">{viewing.session} · {termLabel(viewing.term)}</DetailRow>
                <DetailRow label="Due date">{formatDate(viewing.dueDate)}</DetailRow>
              </dl>

              <div className="rounded-xl border border-slate-200">
                <ul className="divide-y divide-slate-100">
                  {viewing.items.map((item) => (
                    <li key={item.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold text-slate-800">{naira(item.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-bold text-upwa-navy">Total billed</span>
                  <span className="font-display text-base font-bold text-upwa-navy">{naira(invoiceTotal(viewing))}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</p>
                {invoicePayments.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No payment recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {invoicePayments.map((payment) => (
                      <li key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{naira(payment.amount)}</p>
                          <p className="truncate font-mono text-[11px] text-slate-500">{payment.receiptNumber} · {payment.reference}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge status={payment.status} />
                          <p className="mt-1 text-[11px] text-slate-500">{formatDate(payment.paidAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {row ? (
                <div className="flex items-center justify-between rounded-2xl bg-upwa-navy px-5 py-4 text-white">
                  <span className="text-sm font-semibold">Outstanding balance</span>
                  <span className="font-display text-xl font-bold">{naira(row.balance)}</span>
                </div>
              ) : null}
            </div>
          );
        })() : null}
      </Modal>

      {/* Record / edit payment */}
      <Modal
        open={Boolean(payingFor) && (Boolean(editingPayment) || Boolean(payingFor))}
        onClose={() => { setPayingFor(null); setEditingPayment(null); }}
        title={editingPayment ? `Edit ${editingPayment.receiptNumber}` : "Record a payment"}
        subtitle={editingPayment ? "Correct an amount, channel or review status." : payingFor ? `${payingFor.invoiceNumber} · billed ${naira(invoiceTotal(payingFor))}` : undefined}
      >
        <SchemaForm
          schema={paymentSchema}
          value={paymentValues}
          onChange={setPaymentValues}
          onSubmit={editingPayment ? submitPaymentEdit : submitPayment}
          onCancel={() => { setPayingFor(null); setEditingPayment(null); }}
          submitLabel={editingPayment ? "Save payment" : "Record payment"}
          note={
            payingFor && !editingPayment ? (
              <p className="rounded-xl bg-upwa-blue-50 px-4 py-3 text-xs leading-5 text-upwa-blue-900">
                Balance on this invoice: <strong>{naira(Math.max(0, invoiceTotal(payingFor) - confirmedPayments(payments, payingFor.id)))}</strong>.
                Part payments are allowed; the invoice status updates automatically once the total is covered.
              </p>
            ) : null
          }
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingInvoice)}
        title="Delete this invoice?"
        body={pendingInvoice ? `${pendingInvoice.invoiceNumber} will be removed along with its place in the bursary ledger. Payments already recorded against it are kept for audit.` : ""}
        onCancel={() => setPendingInvoice(null)}
        onConfirm={() => {
          if (pendingInvoice) {
            remove("invoices", pendingInvoice.id);
            notify("Invoice deleted", "danger", pendingInvoice.invoiceNumber);
          }
          setPendingInvoice(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingPayment)}
        title="Delete this payment?"
        body={pendingPayment ? `${pendingPayment.receiptNumber} for ${naira(pendingPayment.amount)} will be removed from the ledger. In the live product this is restricted to the bursar and is recorded in the audit log.` : ""}
        onCancel={() => setPendingPayment(null)}
        onConfirm={() => {
          if (pendingPayment) {
            remove("payments", pendingPayment.id);
            notify("Payment deleted", "danger", pendingPayment.receiptNumber);
          }
          setPendingPayment(null);
        }}
      />
    </div>
  );
}
