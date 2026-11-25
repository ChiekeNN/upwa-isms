import { createHash } from "node:crypto";
import { buildPresidentPdf, type PresidentPdf } from "@/app/portal/demo/president-pdf";
import { computePresidentBrief } from "@/app/portal/demo/president-brief";
import { buildDemoData } from "@/app/portal/demo/seed";
import { naira } from "@/app/portal/demo/format";

/**
 * Server-side delivery of the President's reports.
 *
 * Two entry points share this module so the email is always the same report:
 *
 *   - `/api/cron/president-report` builds it here on schedule (workdays 4:00 PM
 *     and Fridays 6:00 PM, West Africa Time).
 *   - `/api/president/dispatch` mails the copy the browser already has open,
 *     so anything she changed in the demo portal is reflected.
 *
 * Recipients are fixed by configuration and never taken from a request body:
 * this is a report line to the President's Office, not a mail relay.
 */

export type ReportKind = "daily" | "weekly";

/** The President's report address, sanctioned for the demonstration portal. */
const DEFAULT_RECIPIENT = "chiekenn@gmail.com";
const MAX_PDF_BYTES = 6 * 1024 * 1024;

const esc = (value: unknown) =>
  String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export type ReportConfig = {
  apiKey: string;
  from: string;
  recipients: string[];
  configured: boolean;
};

export function reportConfig(): ReportConfig {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  const from = process.env.PRESIDENT_FROM_EMAIL ?? process.env.BRIEF_FROM_EMAIL ?? "";
  const recipients = (process.env.PRESIDENT_REPORT_TO ?? DEFAULT_RECIPIENT)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(value));
  return { apiKey, from, recipients, configured: Boolean(apiKey && from && recipients.length > 0) };
}

/** Nigeria is UTC+1 year-round, so the schedule matches her office clock. */
export function lagosNow(now = new Date()) {
  return new Date(now.getTime() + 60 * 60 * 1000);
}

/** Rebuilds the deterministic demonstration ledger for a given day. */
export function buildScheduledReport(kind: ReportKind, now = new Date()) {
  const today = lagosNow(now);
  const data = buildDemoData(today);
  return { data, brief: computePresidentBrief(data), pdf: buildPresidentPdf(data, kind) };
}

export function reportHtml(kind: ReportKind, brief: ReturnType<typeof computePresidentBrief>, settings: { presidentEmail: string; session: string }) {
  const rows = [
    ["Money in the account today", naira(brief.cash)],
    ["Billed this term", naira(brief.billed)],
    [`Collected (confirmed)`, `${naira(brief.collected)} · ${brief.collectionRate}%`],
    ["Spent this term", naira(brief.spent)],
    ["Overdue from families", naira(brief.overdueValue)],
  ];
  if (kind === "weekly") {
    rows.push(
      ["Collected this week", naira(brief.thisWeek.income)],
      ["Spent this week", naira(brief.thisWeek.spend)],
      ["Attendance this week", `${brief.thisWeek.rate}%`],
    );
  } else {
    const bankedToday = brief.paidToday.reduce((sum, p) => sum + p.amount, 0);
    rows.push(
      ["In school on the latest register", `${brief.attendanceRate}%`],
      ["Paid into the bursary today", bankedToday ? naira(bankedToday) : "No confirmed payments yet"],
    );
  }
  const attention = brief.attention.map((item) => `<li style="margin:0 0 6px">${esc(item.text)}</li>`).join("");
  const categories = brief.byCategory
    .slice(0, 5)
    .map((c) => `<tr><td style="padding:4px 0;color:#475569">${esc(c.name)}</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0b2e46">${esc(naira(c.value))}</td></tr>`)
    .join("");

  return `<main style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#0f172a;background:#fff">
  <div style="background:#0b2e46;padding:20px 24px">
    <p style="margin:0;text-transform:uppercase;letter-spacing:.08em;color:#f39a1e;font-size:12px;font-weight:700">UPWA International Group of Schools</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:21px">${kind === "daily" ? "The President&rsquo;s Daily Brief" : "The President&rsquo;s Weekly Comprehensive Report"}</h1>
    <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px">${kind === "daily" ? "Prepared at the close of work, 4:00 PM" : "Prepared Friday, 6:00 PM"} &middot; West Africa Time</p>
  </div>
  <div style="padding:22px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6">Good day, Dr. Chike. Your ${kind === "daily" ? "close-of-work brief" : "weekly report"} is attached as a PDF. Here is the short version.</p>
    <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#0b2e46">Money</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px">
      ${rows.map(([label, value]) => `<tr><td style="padding:4px 0;color:#475569">${esc(label)}</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#0b2e46">${esc(value)}</td></tr>`).join("")}
    </table>
    <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#0b2e46">Where the term's money went</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:18px">${categories}</table>
    <h2 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#0b2e46">For your attention</h2>
    <ul style="margin:0 0 18px;padding-left:18px;font-size:14px;line-height:1.55;color:#334155">${attention || "<li>Nothing needs your decision today.</li>"}</ul>
    <p style="margin:0;font-size:12px;color:#94a3b8">Session ${esc(settings.session)} &middot; sent to ${esc(settings.presidentEmail)} &middot; UPWA-ISMS, President's Office. Management information, not audited accounts.</p>
  </div>
</main>`;
}

export type SendOutcome =
  | { delivered: true; id: string; to: string[]; filename: string; subject: string }
  | { delivered: false; configured: boolean; error: string; status?: number };

/** Mails a finished report PDF. `salt` keeps re-clicks from duplicating a send. */
export async function sendReport(
  pdf: PresidentPdf,
  options: { kind: ReportKind; recipients: string[]; html?: string; salt?: string; from: string; apiKey: string },
): Promise<SendOutcome> {
  const content = Buffer.from(pdf.arrayBuffer);
  if (content.byteLength > MAX_PDF_BYTES) {
    return { delivered: false, configured: true, error: `The report PDF is too large to mail (${Math.round(content.byteLength / 1024)} KB).` };
  }
  const idempotency = createHash("sha256")
    .update(`${options.kind}|${options.recipients.join(",")}|${pdf.subject}|${options.salt ?? ""}|${createHash("sha256").update(content).digest("hex")}`)
    .digest("hex");

  let delivery: Response;
  try {
    delivery = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json", "Idempotency-Key": idempotency },
      body: JSON.stringify({
        from: options.from,
        to: options.recipients,
        subject: pdf.subject,
        text: pdf.cover,
        html: options.html,
        attachments: [{ filename: pdf.filename, content: content.toString("base64") }],
      }),
      cache: "no-store",
    });
  } catch (error) {
    return { delivered: false, configured: true, error: `Could not reach the mail service: ${(error as Error).message}` };
  }
  const result = (await delivery.json().catch(() => null)) as { id?: string; message?: string; error?: { message?: string } } | null;
  if (delivery.ok && result?.id) return { delivered: true, id: result.id, to: options.recipients, filename: pdf.filename, subject: pdf.subject };
  const detail = result?.message ?? result?.error?.message ?? `Resend answered ${delivery.status}`;
  return { delivered: false, configured: true, error: detail, status: delivery.status };
}

/**
 * Validates a report PDF handed over by the browser, and reassembles it into the
 * same shape the server-side builder returns.
 */
export function decodeClientPdf(payload: {
  filename: unknown;
  subject: unknown;
  cover: unknown;
  pdfBase64: unknown;
}): { ok: true; pdf: PresidentPdf } | { ok: false; error: string } {
  const { filename, subject, cover, pdfBase64 } = payload;
  if (typeof filename !== "string" || !/^UPWA-President-[\w-]+\.pdf$/.test(filename)) return { ok: false, error: "The report file name is not one this service issues." };
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200) return { ok: false, error: "The report needs a subject line." };
  if (typeof pdfBase64 !== "string" || pdfBase64.length < 1024) return { ok: false, error: "The report PDF is missing from the request." };

  let buffer: Buffer;
  try {
    buffer = Buffer.from(pdfBase64, "base64");
  } catch {
    return { ok: false, error: "The report PDF could not be decoded." };
  }
  if (buffer.byteLength > MAX_PDF_BYTES) return { ok: false, error: "The report PDF is larger than 6 MB." };
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, error: "The attachment is not a PDF." };

  return {
    ok: true,
    pdf: {
      filename,
      subject: subject.trim(),
      cover: typeof cover === "string" ? cover.slice(0, 4000) : "",
      arrayBuffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    },
  };
}
