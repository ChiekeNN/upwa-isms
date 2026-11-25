import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildScheduledReport, lagosNow, reportConfig, reportHtml, sendReport, type ReportKind } from "@/lib/president/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled delivery of the President's reports, on the same clock the portal
 * advertises: the daily brief at the close of work on weekdays, and the
 * comprehensive report on Friday evening (both West Africa Time).
 *
 * Unlike `cron/morning-brief`, this route needs no database: the demonstration
 * ledger is rebuilt deterministically here, and the PDF is the very file the
 * President's Office downloads. Delivery history is shown in the portal's own
 * "Report delivery" panel rather than written to Supabase, so the demo portal
 * never touches the school's real records.
 */

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || bearer.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(bearer));
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Scheduled job authentication required." }, { status: 401 });

  const config = reportConfig();
  if (!config.configured) {
    return NextResponse.json(
      { error: "President's report delivery is not configured.", hint: "Set RESEND_API_KEY and PRESIDENT_FROM_EMAIL (optionally PRESIDENT_REPORT_TO)." },
      { status: 503 },
    );
  }

  const kinds = (request.nextUrl.searchParams.get("kind") ?? "daily,weekly")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is ReportKind => value === "daily" || value === "weekly");
  if (kinds.length === 0) return NextResponse.json({ error: "Specify kind: daily, weekly, or both." }, { status: 400 });

  const now = lagosNow();
  const today = now.toISOString().slice(0, 10);
  const day = now.getUTCDay();
  const results: { kind: ReportKind; delivered: boolean; detail: string }[] = [];

  for (const kind of kinds) {
    // Guard the schedule when it is invoked outside its slot (manual test runs).
    const inSlot = kind === "daily" ? day >= 1 && day <= 5 : day === 5;
    if (!inSlot && request.nextUrl.searchParams.get("force") !== "1") {
      results.push({ kind, delivered: false, detail: "Not in its delivery slot (weekdays for the daily brief, Friday for the weekly report)." });
      continue;
    }
    try {
      const { data, brief, pdf } = buildScheduledReport(kind);
      const report = await pdf;
      const outcome = await sendReport(report, {
        kind,
        recipients: config.recipients,
        from: config.from,
        apiKey: config.apiKey,
        html: reportHtml(kind, brief, data.settings),
        salt: `cron-${today}`,
      });
      results.push(
        outcome.delivered
          ? { kind, delivered: true, detail: `${report.filename} → ${outcome.to.join(", ")} (id ${outcome.id})` }
          : { kind, delivered: false, detail: outcome.error },
      );
    } catch (error) {
      results.push({ kind, delivered: false, detail: `Could not build the report: ${(error as Error).message}` });
    }
  }

  const sent = results.filter((r) => r.delivered).length;
  const fingerprint = createHash("sha256").update(`${today}|${kinds.join(",")}|${config.recipients.join(",")}`).digest("hex").slice(0, 12);
  return NextResponse.json({ date: today, requested: kinds.length, sent, failed: results.length - sent, run: fingerprint, results });
}

export const POST = GET;
