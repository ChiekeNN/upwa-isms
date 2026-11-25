import { NextRequest, NextResponse } from "next/server";
import { decodeClientPdf, reportConfig, reportHtml, sendReport } from "@/lib/president/reports";
import { buildDemoData } from "@/app/portal/demo/seed";
import { computePresidentBrief } from "@/app/portal/demo/president-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Email it now" from the President's Office.
 *
 * The browser hands over the PDF it just built, so the mail matches exactly what
 * she is looking at. Recipients come from configuration only — this endpoint
 * cannot be pointed at an arbitrary address.
 */

/** Best-effort per-instance throttle: the fixed recipient list is the real guard. */
const recent = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 12;

function allow(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (hits.length >= MAX_PER_HOUR) {
    recent.set(key, hits);
    return false;
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 500) for (const [k, v] of recent) if (v.every((at) => now - at >= WINDOW_MS)) recent.delete(k);
  return true;
}

export async function POST(request: NextRequest) {
  const config = reportConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        configured: false,
        delivered: false,
        error: "Mail delivery is not configured.",
        hint: "Set RESEND_API_KEY and PRESIDENT_FROM_EMAIL (and optionally PRESIDENT_REPORT_TO) in the Vercel environment.",
      },
      { status: 503 },
    );
  }

  const fingerprint = `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}|${config.recipients.join(",")}`;
  if (!allow(fingerprint)) return NextResponse.json({ configured: true, delivered: false, error: "Too many report requests. Try again in an hour." }, { status: 429 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ configured: true, delivered: false, error: "The request body is not valid JSON." }, { status: 400 });
  }

  const kind = body.kind === "weekly" ? "weekly" : body.kind === "daily" ? "daily" : null;
  if (!kind) return NextResponse.json({ configured: true, delivered: false, error: "Specify kind: \"daily\" or \"weekly\"." }, { status: 400 });

  const decoded = decodeClientPdf(body as { filename: unknown; subject: unknown; cover: unknown; pdfBase64: unknown });
  if (!decoded.ok) return NextResponse.json({ configured: true, delivered: false, error: decoded.error }, { status: 400 });

  const data = buildDemoData();
  const outcome = await sendReport(decoded.pdf, {
    kind,
    recipients: config.recipients,
    from: config.from,
    apiKey: config.apiKey,
    html: reportHtml(kind, computePresidentBrief(data), data.settings),
    salt: `manual-${kind}`,
  });

  if (!outcome.delivered) {
    return NextResponse.json({ configured: true, delivered: false, error: outcome.error }, { status: outcome.status && outcome.status >= 400 && outcome.status < 600 ? outcome.status : 502 });
  }
  return NextResponse.json({ configured: true, delivered: true, to: outcome.to, filename: outcome.filename, subject: outcome.subject, id: outcome.id });
}
