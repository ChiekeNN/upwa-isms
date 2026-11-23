import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const accessResult = await requirePortalAccess(division, ["results.read", "academics.read", "parent.read", "student.read"]);
  if (!accessResult.ok) return accessResult.response;
  const { data: verification, error } = await accessResult.access.supabase.from("report_verification").select("id,document_reference,version,status,issued_at").eq("document_reference", reference).maybeSingle();
  if (error) return NextResponse.json({ error: "This report is unavailable to your account." }, { status: 403 });
  if (!verification) return NextResponse.json({ error: "Report reference not found." }, { status: 404 });
  if (verification.status !== "VALID") return NextResponse.json({ error: `This report version is ${verification.status.toLowerCase()}; use the current issued version.` }, { status: 409 });
  const { data: report, error: reportError } = await accessResult.access.supabase.from("report_card_snapshots").select("snapshot,student_id,division_id").eq("verification_id", verification.id).maybeSingle();
  if (reportError || !report) return NextResponse.json({ error: "This report is not linked to an authorised child." }, { status: 403 });
  return NextResponse.json({ reference: verification.document_reference, version: verification.version, issuedAt: verification.issued_at, snapshot: report.snapshot });
}
