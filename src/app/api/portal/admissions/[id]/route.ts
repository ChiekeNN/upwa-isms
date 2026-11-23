import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const DecisionInput = z.object({
  division: z.enum(["PRIMARY_EARLY_YEARS", "SECONDARY"]),
  status: z.enum(["UNDER_REVIEW", "EXAM_SCHEDULED", "OFFERED", "WAITLISTED", "ACCEPTED", "REJECTED", "ENROLLED"]),
  decisionNote: z.string().trim().max(1000).optional().default(""),
  examAt: z.string().datetime().optional(),
  examVenue: z.string().trim().max(200).optional(),
});

const TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "EXAM_SCHEDULED", "WAITLISTED", "REJECTED"],
  UNDER_REVIEW: ["EXAM_SCHEDULED", "OFFERED", "WAITLISTED", "REJECTED"],
  EXAM_SCHEDULED: ["OFFERED", "WAITLISTED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED"],
  WAITLISTED: ["OFFERED", "REJECTED"],
  ACCEPTED: ["ENROLLED"],
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid application reference." }, { status: 400 });
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "A valid decision is required." }, { status: 400 });
  }
  const parsed = DecisionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the decision details and try again." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["admissions.manage"]);
  if (!result.ok) return result.response;

  if (parsed.data.status === "ENROLLED") {
    const { data, error } = await result.access.supabase.rpc("upwa_enroll_admission", { p_application_id: id });
    if (error) return NextResponse.json({ error: "The accepted application could not be enrolled." }, { status: 400 });
    return NextResponse.json({ studentId: data, status: "ENROLLED" });
  }

  const { data: application, error: lookupError } = await result.access.supabase
    .from("admission_applications")
    .select("id, status, division_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError || !application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  if (!TRANSITIONS[application.status]?.includes(parsed.data.status)) {
    return NextResponse.json({ error: `This application cannot move from ${application.status} to ${parsed.data.status}.` }, { status: 409 });
  }

  const patch: Record<string, string | null> = {
    status: parsed.data.status,
    decision_note: parsed.data.decisionNote || null,
  };
  if (parsed.data.examAt) patch.exam_at = parsed.data.examAt;
  if (parsed.data.examVenue !== undefined) patch.exam_venue = parsed.data.examVenue || null;
  const { data, error } = await result.access.supabase
    .from("admission_applications")
    .update(patch)
    .eq("id", id)
    .select("id, application_number, status, exam_at, exam_venue, updated_at")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "The application decision could not be saved." }, { status: 403 });
  return NextResponse.json({ application: data });
}
