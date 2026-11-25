import { computePresidentBrief, iso } from "./president-brief";
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
  const plainWords =
    kind === "daily"
      ? `${brief.attendanceRate}% of pupils were in school ${registerDay === "Today" ? "today" : `on ${registerDay}`} — about ${Math.round(brief.attendanceRate / 10)} in every 10. The bursary ${banked ? `banked ${naira(banked)}` : "confirmed no payments"} and the school spent ${spent ? naira(spent) : "nothing"}. ${firstFlag}`
      : `Attendance averaged ${brief.thisWeek.rate}% against ${brief.lastWeek.rate}% last week. The school collected ${naira(brief.thisWeek.income)} and spent ${naira(brief.thisWeek.spend)}, leaving ${naira(brief.cash)} in the account. ${firstFlag}`;

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

  heading(kind === "daily" ? "Today's activity" : "The week's activity");
  if (kind === "daily") {
    text(
      `• Register: ${brief.present} present, ${brief.late} late, ${brief.absent} absent, ${brief.excused} excused across ${new Set(data.attendance.filter((r) => r.date === brief.latestRegister).map((r) => `${r.className} ${r.arm}`)).size} classes.`,
    );
    text(`• Bursary: ${brief.paidToday.length} confirmed payment(s); ${brief.pending.length} transfer(s) awaiting review.`);
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
          "Prepared automatically by UPWA-ISMS on Friday at 6:00 PM.",
        ].join("\n");

  return { filename, subject, cover, arrayBuffer: doc.output("arraybuffer") };
}
