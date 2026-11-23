import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const studentId = request.nextUrl.searchParams.get("studentId");
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const termId = request.nextUrl.searchParams.get("termId");
  const accessResult = await requirePortalAccess(division, ["results.read", "academics.read", "parent.read", "student.read"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  let studentQuery = access.supabase.from("students").select("id,admission_number,first_name,middle_name,last_name,current_division_id,current_class_id").order("last_name");
  if (studentId) studentQuery = studentQuery.eq("id", studentId);
  if (access.divisionId) studentQuery = studentQuery.eq("current_division_id", access.divisionId);
  const { data: students, error: studentError } = await studentQuery.limit(500);
  if (studentError) return NextResponse.json({ error: "Could not load children linked to this account." }, { status: 503 });
  if (!studentId) return NextResponse.json({ students: students ?? [], sessions: [], terms: [], scores: [], appraisals: [], issuedReports: [] });
  if (!(students ?? []).some((student) => student.id === studentId)) return NextResponse.json({ error: "This pupil is not linked to your authorised account." }, { status: 403 });
  let scoreQuery = access.supabase.from("assessment_scores").select("id,student_id,division_id,class_id,subject_id,component_id,session_id,term_id,numeric_score,developmental_level,score_state,status,published_at,subjects(name,code),assessment_components(code,label,maximum_score,weight,precision_digits,counts_toward_total)").eq("student_id", studentId).eq("status", "PUBLISHED").order("published_at", { ascending: false });
  if (sessionId) scoreQuery = scoreQuery.eq("session_id", sessionId);
  if (termId) scoreQuery = scoreQuery.eq("term_id", termId);
  const invoicesQuery = access.permissions.includes("parent.read") || access.permissions.includes("finance.read")
    ? access.supabase.from("invoices").select("id,invoice_number,total_amount,amount_paid,status,due_date,session_id,term_id").eq("student_id", studentId).order("created_at", { ascending: false }).limit(30)
    : Promise.resolve({ data: [], error: null });
  const [scores, appraisals, sessions, terms, cards, invoices] = await Promise.all([
    scoreQuery,
    access.supabase.from("student_behaviour_appraisals").select("id,appraisal_key,rating,teacher_remark,session_id,term_id,updated_at").eq("student_id", studentId).eq("status", "PUBLISHED").order("updated_at", { ascending: false }),
    access.supabase.from("sessions").select("id,name").order("starts_on", { ascending: false }),
    access.supabase.from("terms").select("id,name,session_id").order("name"),
    access.supabase.from("report_card_snapshots").select("verification_id,session_id,term_id,created_at").eq("student_id", studentId).order("created_at", { ascending: false }).limit(20),
    invoicesQuery,
  ]);
  if (scores.error || appraisals.error || sessions.error || terms.error || cards.error || invoices.error) return NextResponse.json({ error: "Published results could not be loaded." }, { status: 503 });
  const cardIds = (cards.data ?? []).map((item) => item.verification_id);
  const reportLinks = cardIds.length ? await access.supabase.from("report_verification").select("id,document_reference,version,status,issued_at").in("id", cardIds) : { data: [], error: null };
  if (reportLinks.error) return NextResponse.json({ error: "Issued report references could not be loaded." }, { status: 503 });
  const reportById = new Map((reportLinks.data ?? []).map((item) => [item.id, item]));
  const issuedReports = (cards.data ?? []).flatMap((item) => { const report = reportById.get(item.verification_id); return report ? [{ ...report, session_id: item.session_id, term_id: item.term_id }] : []; });
  return NextResponse.json({ students, sessions: sessions.data ?? [], terms: terms.data ?? [], scores: scores.data ?? [], appraisals: appraisals.data ?? [], issuedReports, invoices: invoices.data ?? [] });
}

const IssueInput = z.object({ action: z.literal("ISSUE_REPORT"), division: z.string(), studentId: z.string().uuid(), sessionId: z.string().uuid(), termId: z.string().uuid() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "A valid report request is required." }, { status: 400 }); }
  const parsed = IssueInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Report fields are incomplete." }, { status: 400 });
  const { division, studentId, sessionId, termId } = parsed.data;
  const accessResult = await requirePortalAccess(division, ["results.publish"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  const signingKey = process.env.REPORT_SIGNING_KEY;
  if (!signingKey || signingKey.length < 32) return NextResponse.json({ error: "Report signing is not configured. Ask the system administrator to set REPORT_SIGNING_KEY." }, { status: 503 });
  const [studentResult, scoresResult, sessionResult, termResult, bandsResult] = await Promise.all([
    access.supabase.from("students").select("id,admission_number,first_name,middle_name,last_name,date_of_birth,current_division_id,current_class_id,photo_storage_path").eq("id", studentId).single(),
    access.supabase.from("assessment_scores").select("id,subject_id,component_id,numeric_score,developmental_level,score_state,subjects(name,code),assessment_components(code,label,maximum_score,weight,counts_toward_total,is_developmental)").eq("student_id", studentId).eq("session_id", sessionId).eq("term_id", termId).eq("status", "PUBLISHED"),
    access.supabase.from("sessions").select("name").eq("id", sessionId).single(),
    access.supabase.from("terms").select("name").eq("id", termId).single(),
    access.supabase.from("grading_scale_bands").select("grade_code,label,minimum_score,maximum_score,remark").eq("division_id", access.divisionId).order("minimum_score", { ascending: false }),
  ]);
  if (studentResult.error || scoresResult.error || sessionResult.error || termResult.error || bandsResult.error || !scoresResult.data?.length) return NextResponse.json({ error: "Only a complete set of published marks can be issued as a report." }, { status: 409 });
  const scores = scoresResult.data as unknown as { subject_id: string; numeric_score: number | null; developmental_level: string | null; score_state: string; subjects: { name: string; code: string } | null; assessment_components: { label: string; maximum_score: number; weight: number; counts_toward_total: boolean; is_developmental: boolean } | null }[];
  const subjectResults = Array.from(new Set(scores.map((row) => row.subject_id))).map((subjectId) => {
    const subjectScores = scores.filter((row) => row.subject_id === subjectId);
    let weighted = 0; let weightTotal = 0;
    for (const row of subjectScores) {
      const component = row.assessment_components;
      if (!component?.counts_toward_total || component.is_developmental || row.score_state !== "PRESENT" || row.numeric_score === null) continue;
      weighted += (Number(row.numeric_score) / Number(component.maximum_score)) * Number(component.weight);
      weightTotal += Number(component.weight);
    }
    return { subject: subjectScores[0]?.subjects?.name ?? "Subject", code: subjectScores[0]?.subjects?.code ?? "", percentage: weightTotal ? Math.round(weighted / weightTotal * 10000) / 100 : null };
  });
  const validSubjectTotals = subjectResults.map((item) => item.percentage).filter((value): value is number => value !== null);
  const total = validSubjectTotals.length ? Math.round(validSubjectTotals.reduce((sum, value) => sum + value, 0) / validSubjectTotals.length * 100) / 100 : null;
  const grade = total === null ? undefined : (bandsResult.data ?? []).find((band) => total >= Number(band.minimum_score) && total <= Number(band.maximum_score));
  const previousSnapshots = await access.supabase.from("report_card_snapshots").select("verification_id").eq("student_id", studentId).eq("session_id", sessionId).eq("term_id", termId);
  if (previousSnapshots.error) return NextResponse.json({ error: "Could not determine the next report version." }, { status: 503 });
  const previousIds = (previousSnapshots.data ?? []).map((row) => row.verification_id);
  const previous = previousIds.length ? await access.supabase.from("report_verification").select("version").in("id", previousIds).order("version", { ascending: false }).limit(1).maybeSingle() : { data: null, error: null };
  if (previous.error) return NextResponse.json({ error: "Could not determine the next report version." }, { status: 503 });
  const version = Number(previous.data?.version ?? 0) + 1;
  const documentReference = `UPWA-${randomBytes(12).toString("hex").toUpperCase()}`;
  const snapshot = {
    issuer: "UPWA International Schools",
    division: division,
    student: { id: studentResult.data.id, admissionNumber: studentResult.data.admission_number, name: [studentResult.data.first_name, studentResult.data.middle_name, studentResult.data.last_name].filter(Boolean).join(" "), dateOfBirth: studentResult.data.date_of_birth, photoPath: studentResult.data.photo_storage_path },
    session: sessionResult.data.name,
    term: termResult.data.name,
    scores: scores.map((row) => ({ subject: row.subjects?.name ?? "Subject", component: row.assessment_components?.label ?? "Assessment", maximum: row.assessment_components?.maximum_score, score: row.numeric_score, developmentalLevel: row.developmental_level, scoreState: row.score_state })),
    subjectResults, total, grade: grade?.grade_code ?? null, gradeLabel: grade?.label ?? null, gradeRemark: grade?.remark ?? null,
    issuedAt: new Date().toISOString(), version,
  };
  const snapshotHash = createHash("sha256").update(stableJson(snapshot)).digest("hex");
  const payload = `${documentReference}|${studentId}|${sessionId}|${termId}|${version}|${snapshotHash}`;
  const signature = createHmac("sha256", signingKey).update(payload).digest("hex");
  const { data, error } = await access.supabase.rpc("upwa_issue_report_card", { p_student_id: studentId, p_session_id: sessionId, p_term_id: termId, p_document_reference: documentReference, p_version: version, p_snapshot: snapshot, p_signature: signature });
  if (error) return NextResponse.json({ error: "The report could not be issued. Verify the pupil, division and published results." }, { status: 409 });
  return NextResponse.json({ reference: documentReference, version, verificationId: data }, { status: 201 });
}
