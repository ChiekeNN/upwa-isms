import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "";
  const classId = request.nextUrl.searchParams.get("classId") || "";
  const subjectId = request.nextUrl.searchParams.get("subjectId") || "";
  const sessionId = request.nextUrl.searchParams.get("sessionId") || "";
  const termId = request.nextUrl.searchParams.get("termId") || "";
  const accessResult = await requirePortalAccess(division, ["academics.read", "results.review"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  const [classes, subjects, sessions, terms] = await Promise.all([
    access.supabase.from("classes").select("id,name,sort_order,division_id").eq("division_id", access.divisionId).order("sort_order"),
    access.supabase.from("subjects").select("id,code,name,division_id").eq("division_id", access.divisionId).eq("is_active", true).order("name"),
    access.supabase.from("sessions").select("id,name,is_current,starts_on,ends_on").order("starts_on", { ascending: false }),
    access.supabase.from("terms").select("id,name,session_id,is_current").order("name"),
  ]);
  if (classes.error || subjects.error || sessions.error || terms.error) return NextResponse.json({ error: "Could not load academic filters." }, { status: 503 });
  if (!classId || !subjectId || !sessionId || !termId) return NextResponse.json({ classes: classes.data ?? [], subjects: subjects.data ?? [], sessions: sessions.data ?? [], terms: terms.data ?? [], batch: null, students: [], components: [], grades: [] });
  if (!(classes.data ?? []).some((item) => item.id === classId) || !(subjects.data ?? []).some((item) => item.id === subjectId)) return NextResponse.json({ error: "Select a class and subject within this division." }, { status: 400 });
  const [students, components, bands, batch] = await Promise.all([
    access.supabase.from("students").select("id,admission_number,first_name,middle_name,last_name,current_class_id,status").eq("current_class_id", classId).eq("status", "ACTIVE").order("last_name"),
    access.supabase.from("assessment_components").select("id,code,label,maximum_score,weight,precision_digits,is_developmental,counts_toward_total,sort_order").eq("division_id", access.divisionId).eq("is_active", true).order("sort_order"),
    access.supabase.from("grading_scale_bands").select("grade_code,label,minimum_score,maximum_score,remark").eq("division_id", access.divisionId).order("minimum_score", { ascending: false }),
    access.supabase.from("assessment_batches").select("id,status,version,submitted_at,reviewed_at,approved_at,published_at,correction_note").eq("class_id", classId).eq("subject_id", subjectId).eq("session_id", sessionId).eq("term_id", termId).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (students.error || components.error || bands.error || batch.error) return NextResponse.json({ error: "Could not load the authorised score sheet." }, { status: 503 });
  let scores: Record<string, unknown>[] = [];
  if (batch.data) {
    const response = await access.supabase.from("assessment_scores").select("id,student_id,component_id,numeric_score,developmental_level,score_state,status").eq("class_id", classId).eq("subject_id", subjectId).eq("session_id", sessionId).eq("term_id", termId);
    if (response.error) return NextResponse.json({ error: "Could not load saved marks." }, { status: 503 });
    scores = response.data ?? [];
  }
  return NextResponse.json({ classes: classes.data ?? [], subjects: subjects.data ?? [], sessions: sessions.data ?? [], terms: terms.data ?? [], students: students.data ?? [], components: components.data ?? [], grades: bands.data ?? [], batch: batch.data, scores });
}

const SaveInput = z.object({ action: z.literal("SAVE"), division: z.string(), batchId: z.string().uuid().optional(), classId: z.string().uuid(), subjectId: z.string().uuid(), sessionId: z.string().uuid(), termId: z.string().uuid(), rows: z.array(z.object({ student_id: z.string().uuid(), component_id: z.string().uuid(), score_state: z.enum(["PRESENT","ABSENT","MISSING"]), numeric_score: z.number().finite().nullable().optional(), developmental_level: z.string().max(60).nullable().optional() })).max(2000) });
const ActionInput = z.object({ action: z.enum(["SUBMIT","REVIEW","APPROVE","PUBLISH","REQUEST_CORRECTION","APPROVE_CORRECTION"]), division: z.string(), batchId: z.string().uuid(), note: z.string().max(2000).optional() });

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A valid score operation is required." }, { status: 400 }); }
  const parsed = SaveInput.safeParse(body);
  const actionParsed = ActionInput.safeParse(body);
  if (!parsed.success && !actionParsed.success) return NextResponse.json({ error: "Check the score operation and required fields." }, { status: 400 });
  const data = parsed.success ? parsed.data : actionParsed.data!;
  const accessResult = await requirePortalAccess(data.division, parsed.success ? ["academics.manage"] : ["academics.manage", "results.review", "results.publish"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;

  if (parsed.success) {
    const input = parsed.data;
    let batchId = input.batchId;
    if (!batchId) {
      const { data: existing, error } = await access.supabase.from("assessment_batches").select("id,status").eq("class_id", input.classId).eq("subject_id", input.subjectId).eq("session_id", input.sessionId).eq("term_id", input.termId).order("version", { ascending: false }).limit(1).maybeSingle();
      if (error) return NextResponse.json({ error: "Could not load the score batch." }, { status: 503 });
      if (existing?.status === "CORRECTION_REQUESTED") batchId = existing.id;
      else if (existing) batchId = existing.id;
      else {
        const { data: created, error: createError } = await access.supabase.from("assessment_batches").insert({ division_id: access.divisionId, class_id: input.classId, subject_id: input.subjectId, session_id: input.sessionId, term_id: input.termId, status: "DRAFT" }).select("id").single();
        if (createError || !created) return NextResponse.json({ error: "Could not create this class score sheet." }, { status: 403 });
        batchId = created.id;
      }
    }
    const { data: saved, error } = await access.supabase.rpc("upwa_save_assessment_scores", { p_batch_id: batchId, p_rows: input.rows });
    if (error) return NextResponse.json({ error: error.message.includes("locked") ? error.message : "Marks did not save. Check component limits and class placement." }, { status: 409 });
    return NextResponse.json({ batchId, savedRows: saved, status: "DRAFT" });
  }
  const input = actionParsed.data!;
  const { data: status, error } = await access.supabase.rpc("upwa_transition_assessment_batch", { p_batch_id: input.batchId, p_action: input.action, p_note: input.note ?? null });
  if (error) return NextResponse.json({ error: error.message.includes("not permitted") || error.message.includes("assigned") ? error.message : "The results workflow could not advance." }, { status: 409 });
  return NextResponse.json({ status });
}
