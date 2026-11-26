import { computePresidentBrief, iso } from "./president-brief";
import { reconcileIncome, runIntegrityChecks } from "./integrity";
import { formatDate, formatLongDate, naira, termLabel, weekdayOf } from "./format";
import type { DemoData, Expense } from "./types";

/**
 * Builds the President's PDF briefs.
 *
 * The same bytes the dashboard downloads are the bytes the dispatch route
 * emails: one builder, so her inbox and her screen always agree.
 */

export type PresidentPdf = {
  filename: string;
  subject: string;
  /** Plain-text cover note — used as the email body. */
  cover: string;
  arrayBuffer: ArrayBuffer;
};

export async function buildPresidentPdf(data: DemoData, kind: "daily" | "weekly"): Promise<PresidentPdf> {
  const brief = computePresidentBrief(data);
  // The control register runs over the same data, so the emailed brief carries the
  // same picture of the money trail that her dashboard shows — she never has to
  // open the app to learn that income went missing.
  const summary = runIntegrityChecks(data);
  const recon = reconcileIncome(data);
  const criticals = summary.findings.filter((finding) => finding.severity === "CRITICAL" && !finding.resolved);
  const highs = summary.findings.filter((finding) => finding.severity === "HIGH" && !finding.resolved);
  const awaiting = data.expenseApprovals.filter((entry) => entry.status === "PENDING");
  const { settings } = data;
  const [{ jsPDF }, { PDF_FONT_FAMILY, PDF_FONT_FILES }] = await Promise.all([import("jspdf"), import("./president-font")]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  // Helvetica cannot encode ₦; this face can, so every figure renders correctly.
  for (const { vfs, base64 } of Object.values(PDF_FONT_FILES)) doc.addFileToVFS(vfs, base64);
  doc.addFont(PDF_FONT_FILES.regular.vfs, PDF_FONT_FAMILY, "normal");
  doc.addFont(PDF_FONT_FILES.bold.vfs, PDF_FONT_FAMILY, "bold");
  doc.addFont(PDF_FONT_FILES.regular.vfs, PDF_FONT_FAMILY, "italic");
  doc.addFont(PDF_FONT_FILES.bold.vfs, PDF_FONT_FAMILY, "bolditalic");
  const width = doc.internal.pageSize.getWidth();
  const margin = 48;
  const max = width - margin * 2;
  let y = 54;

  const ensure = (need: number) => {
    if (y + need > 790) {
      doc.addPage();
      y = 54;
    }
  };
  const text = (body: string, size = 10, style: "normal" | "bold" | "italic" = "normal", colour: [number, number, number] = [60, 60, 60], gap = 5) => {
    doc.setFont(PDF_FONT_FAMILY, style);
    doc.setFontSize(size);
    doc.setTextColor(colour[0], colour[1], colour[2]);
    const lines = doc.splitTextToSize(body, max) as string[];
    lines.forEach((line) => {
      ensure(size + 4);
      doc.text(line, margin, y);
      y += size + gap;
    });
  };
  const heading = (body: string) => {
    ensure(30);
    y += 6;
    doc.setDrawColor(243, 154, 30);
    doc.setLineWidth(1.2);
    doc.line(margin, y - 10, margin + 26, y - 10);
    text(body.toUpperCase(), 10.5, "bold", [11, 46, 70], 4);
  };
  const row = (label: string, value: string) => {
    ensure(18);
    doc.setFont(PDF_FONT_FAMILY, "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(label, margin, y);
    doc.setFont(PDF_FONT_FAMILY, "bold");
    doc.setTextColor(11, 46, 70);
    doc.text(value, width - margin, y, { align: "right" });
    y += 16;
  };

  doc.setFillColor(11, 46, 70);
  doc.rect(0, 0, width, 8, "F");
  text("UPWA INTERNATIONAL GROUP OF SCHOOLS", 13, "bold", [11, 46, 70], 3);
  text("University of Port Harcourt Women Association · Choba, Rivers State", 9, "normal", [120, 120, 120], 10);
  text(
    kind === "daily" ? "THE PRESIDENT'S DAILY BRIEF — CLOSE OF WORK" : "THE PRESIDENT'S WEEKLY COMPREHENSIVE REPORT",
    12,
    "bold",
    [243, 154, 30],
    4,
  );
  text(
    kind === "daily"
      ? `${weekdayOf(brief.today)}, ${formatLongDate(brief.today)} · prepared 4:00 PM`
      : `Week of ${formatLongDate(iso(brief.thisMonday))} · delivered Friday 6:00 PM`,
    9.5,
    "italic",
    [120, 120, 120],
    3,
  );
  text(`For: Dr. Chinwe Chike, President · ${settings.presidentEmail}`, 9.5, "normal", [120, 120, 120], 12);

  heading("In plain words");
  const registerDay = formatDate(brief.latestRegister);
  const banked = brief.paidToday.reduce((sum, payment) => sum + payment.amount, 0);
  const spent = brief.spentToday.reduce((sum, expense) => sum + expense.amount, 0);
  const firstFlag = brief.attention[0]?.text ?? "Nothing needs your decision at the moment.";
  const controlSentence = criticals.length
    ? `The money controls scored ${summary.assurance} out of 100, with ${criticals.length} matter${criticals.length === 1 ? "" : "s"} needing your decision${kind === "daily" ? " today" : " this week"} and ${naira(summary.exposure)} unaccounted for.`
    : summary.controlsFailed
      ? `The money controls scored ${summary.assurance} out of 100 — nothing is critical today, but ${summary.controlsFailed} control${summary.controlsFailed === 1 ? " is" : "s are"} not holding.`
      : `The money controls scored ${summary.assurance} out of 100 and every one of the ${summary.controlsTotal} is holding.`;
  const plainWords =
    kind === "daily"
      ? `${brief.attendanceRate}% of pupils were in school ${registerDay === "Today" ? "today" : `on ${registerDay}`} — about ${Math.round(brief.attendanceRate / 10)} in every 10. The bursary ${banked ? `banked ${naira(banked)}` : "confirmed no payments"} and the school spent ${spent ? naira(spent) : "nothing"}. ${controlSentence} ${firstFlag}`
      : `Attendance averaged ${brief.thisWeek.rate}% against ${brief.lastWeek.rate}% last week. The school collected ${naira(brief.thisWeek.income)} and spent ${naira(brief.thisWeek.spend)}, leaving ${naira(brief.cash)} in the account. ${controlSentence} ${firstFlag}`;

  text(plainWords);

  heading("Money");
  row("Billed this term", naira(brief.billed));
  row("Collected (confirmed)", `${naira(brief.collected)}  (${brief.collectionRate}%)`);
  row("Spent this term", naira(brief.spent));
  row("Opening balance, first day of term", naira(settings.openingBalance));
  row("Money in the account today", naira(brief.cash));
  row("Still owed by families past their date", naira(brief.overdueValue));
  if (kind === "weekly") {
    row("Collected this week", naira(brief.thisWeek.income));
    row("Spent this week", naira(brief.thisWeek.spend));
  }
  y += 4;
  text("Biggest spending areas this term:", 10, "bold", [11, 46, 70], 4);
  brief.byCategory.slice(0, 6).forEach((category) => row(category.name, naira(category.value)));

  heading("Money controls & integrity");
  text(
    `${summary.controlsTotal} controls ran over every naira received and spent this term: the bank's own feed against the bursary's ledger, the receipts parents were sent, receipt-book continuity, daily declarations, authorisation limits, duplicate and split payments, payroll against the active staff list, and the record of every change made to the books.`,
    9.5,
    "normal",
    [90, 90, 90],
    6,
  );
  row("Controls holding", `${summary.controlsHeld} of ${summary.controlsTotal}`);
  row("Integrity score", `${summary.assurance} out of 100`);
  row("The bank's feed says the school received", naira(recon.bankTotal));
  row("Parents were sent receipts for", naira(recon.parentTotal));
  row("The bursary's ledger shows", naira(recon.ledgerTotal));
  row("Received but never recorded", recon.bankTotal > recon.ledgerTotal ? naira(recon.bankTotal - recon.ledgerTotal) : naira(0));
  row("Spent without proper approval", naira(summary.unapprovedSpend));
  row("Awaiting your approval", `${awaiting.length} request${awaiting.length === 1 ? "" : "s"} · ${naira(awaiting.reduce((sum, entry) => sum + entry.amount, 0))}`);
  y += 4;
  if (criticals.length) {
    text(`Needs you today (${criticals.length}):`, 10, "bold", [178, 34, 52], 4);
    criticals.slice(0, 6).forEach((finding) => text(`• ${finding.title}${finding.amount ? ` — ${naira(finding.amount)}` : ""}. ${finding.plainWords}`, 9.5));
  }
  if (highs.length) {
    text(`Needs an answer this week (${highs.length}):`, 10, "bold", [184, 93, 14], 4);
    highs.slice(0, kind === "weekly" ? 10 : 5).forEach((finding) => text(`• ${finding.title}${finding.amount ? ` — ${naira(finding.amount)}` : ""}. ${finding.plainWords}`, 9.5));
  }
  if (!criticals.length && !highs.length) text("• Nothing is failing today. Every control in the register is holding.");
  if (awaiting.length) {
    y += 2;
    text("In your approval queue:", 10, "bold", [11, 46, 70], 4);
    awaiting.forEach((entry) => text(`• ${entry.description} — ${naira(entry.amount)} (${entry.vendor}), requested by ${entry.requestedBy} on ${formatDate(entry.date)}.`, 9.5));
  }
  y += 2;
  text(
    "You can approve, refuse, question, escalate or close any of these from the President's Office. Nothing in the ledger is edited from your office, and every decision you take is recorded against your name with the time and your reason.",
    8.5,
    "italic",
    [140, 140, 140],
  );

  heading(kind === "daily" ? "Today's activity" : "The week's activity");
  if (kind === "daily") {
    text(
      `• Register: ${brief.present} present, ${brief.late} late, ${brief.absent} absent, ${brief.excused} excused across ${new Set(data.attendance.filter((r) => r.date === brief.latestRegister).map((r) => `${r.className} ${r.arm}`)).size} classes.`,
    );
    text(`• Bursary: ${brief.paidToday.length} confirmed payment${brief.paidToday.length === 1 ? "" : "s"}; ${brief.pending.length} transfer${brief.pending.length === 1 ? "" : "s"} awaiting review.`);
    brief.spentToday.slice(0, 4).forEach((expense: Expense) => text(`• Spent: ${expense.description} — ${naira(expense.amount)} (${expense.category}).`));
    text(
      `• Admissions: ${brief.thisWeek.applications} new application(s) this week; ${data.applications.filter((a) => a.status === "OFFER_MADE").length} offer(s) with parents.`,
    );
  } else {
    text(`• Registers closed: ${brief.thisWeek.registers} class-registers against ${brief.lastWeek.registers} last week.`);
    text(
      `• New applications: ${brief.thisWeek.applications} (last week ${brief.lastWeek.applications}). Broadcasts sent: ${brief.thisWeek.messages}. Events held: ${brief.thisWeek.events}.`,
    );
    brief.academicDepartments.forEach((department) =>
      text(`• ${department.name}: ${department.roll} pupils, ${department.rate}% in school today, ${department.feesRate}% of their fees paid.`),
    );
  }

  heading("For your attention");
  brief.attention.forEach((item) => text(`• ${item.text}`));

  ensure(40);
  y += 8;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.6);
  doc.line(margin, y, width - margin, y);
  y += 14;
  text(
    `Generated by UPWA-ISMS, President's Office · ${settings.session}, ${termLabel(settings.currentTerm)} · delivery: ${settings.presidentEmail} (daily 4:00 PM, weekly Fridays 6:00 PM).`,
    8.5,
    "italic",
    [140, 140, 140],
  );

  const filename = `UPWA-President-${kind === "daily" ? "Daily-Brief" : "Weekly-Report"}-${brief.today}.pdf`;
  const subject =
    kind === "daily"
      ? `UPWA · The President's Daily Brief — ${weekdayOf(brief.today)}, ${formatLongDate(brief.today)}`
      : `UPWA · The President's Weekly Comprehensive Report — week of ${formatLongDate(iso(brief.thisMonday))}`;
  const cover =
    kind === "daily"
      ? [
          "Good day, Dr. Chike.",
          "",
          `Your close-of-work brief for ${weekdayOf(brief.today)}, ${formatLongDate(brief.today)} is attached.`,
          "",
          plainWords,
          "",
          `Money in the account today: ${naira(brief.cash)}. Matters for your attention: ${brief.attention.length}.`,
          "",
          ...(recon.bankTotal > recon.ledgerTotal
            ? [`The bank reports ${naira(recon.bankTotal - recon.ledgerTotal)} that the bursary's ledger does not show — the detail is in the attached brief.`]
            : []),
          ...(awaiting.length ? [`${awaiting.length} payment request${awaiting.length === 1 ? "" : "s"} totalling ${naira(awaiting.reduce((sum, entry) => sum + entry.amount, 0))} cannot be paid until you approve ${awaiting.length === 1 ? "it" : "them"}.`] : []),
          "",
          "Prepared automatically by UPWA-ISMS at the close of work.",
        ].join("\n")
      : [
          "Good day, Dr. Chike.",
          "",
          `Your comprehensive report for the week of ${formatLongDate(iso(brief.thisMonday))} is attached.`,
          "",
          plainWords,
          "",
          `This week against last: attendance ${brief.thisWeek.rate}% vs ${brief.lastWeek.rate}%; money in ${naira(brief.thisWeek.income)} vs ${naira(brief.lastWeek.income)}; money out ${naira(brief.thisWeek.spend)} vs ${naira(brief.lastWeek.spend)}.`,
          "",
          ...(criticals.length ? [`The most serious: ${criticals.slice(0, 3).map((finding) => finding.title.toLowerCase()).join("; ")}.`] : []),
          "",
          "Prepared automatically by UPWA-ISMS on Friday at 6:00 PM.",
        ].join("\n");

  return { filename, subject, cover, arrayBuffer: doc.output("arraybuffer") };
}
