import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const Division = z.enum(["PRIMARY_EARLY_YEARS", "SECONDARY"]);

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["registry.manage"]);
  if (!result.ok) return result.response;
  if (!result.access.divisionId) return NextResponse.json({ error: "Select one school division to manage academic setup." }, { status: 400 });

  const db = result.access.supabase;
  const [sessions, terms, sections, classes, subjects] = await Promise.all([
    db.from("sessions").select("id,name,is_current,starts_on,ends_on").order("starts_on", { ascending: false }).limit(50),
    db.from("terms").select("id,session_id,name,is_current").order("name").limit(100),
    db.from("school_sections").select("id,division_id,name").eq("division_id", result.access.divisionId).order("name"),
    db.from("classes").select("id,division_id,section_id,name,sort_order").eq("division_id", result.access.divisionId).order("sort_order").order("name"),
    db.from("subjects").select("id,division_id,code,name,is_active").eq("division_id", result.access.divisionId).order("name"),
  ]);
  const failed = [sessions, terms, sections, classes, subjects].find((query) => query.error);
  if (failed?.error) return NextResponse.json({ error: "Academic setup schema is not ready. Apply the pending academic setup migration, then reload." }, { status: 503 });

  const classIds = (classes.data ?? []).map((item) => item.id);
  const arms = classIds.length
    ? await db.from("class_arms").select("id,class_id,name").in("class_id", classIds).order("name")
    : { data: [], error: null };
  if (arms.error) return NextResponse.json({ error: "Class arm data is unavailable. Apply the pending academic setup migration, then reload." }, { status: 503 });

  return NextResponse.json({
    sessions: sessions.data ?? [], terms: terms.data ?? [], sections: sections.data ?? [],
    classes: classes.data ?? [], arms: arms.data ?? [], subjects: subjects.data ?? [],
  });
}

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("session"), division: Division, name: z.string().trim().min(4).max(40).regex(/^\d{4}\/\d{4}$/), startsOn: z.string().date(), endsOn: z.string().date() }).refine((value) => value.startsOn < value.endsOn, { path: ["endsOn"], message: "End date must be after start date." }),
  z.object({ action: z.literal("term"), division: Division, sessionId: z.string().uuid(), name: z.string().trim().min(2).max(60) }),
  z.object({ action: z.literal("section"), division: Division, name: z.string().trim().min(2).max(80) }),
  z.object({ action: z.literal("class"), division: Division, sectionId: z.string().uuid().nullable(), name: z.string().trim().min(2).max(80), sortOrder: z.number().int().min(0).max(1000).default(0) }),
  z.object({ action: z.literal("arm"), division: Division, classId: z.string().uuid(), name: z.string().trim().min(1).max(40) }),
  z.object({ action: z.literal("subject"), division: Division, code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/), name: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal("activate"), division: Division, sessionId: z.string().uuid(), termId: z.string().uuid().nullable() }),
]);

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "A valid academic setup request is required." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["registry.manage"]);
  if (!result.ok) return result.response;
  if (!result.access.divisionId) return NextResponse.json({ error: "Select one school division." }, { status: 400 });

  const db = result.access.supabase;
  const divisionId = result.access.divisionId;
  const item = parsed.data;
  let error: { code?: string; message?: string } | null = null;
  let saved: unknown = null;

  if (item.action === "session") {
    const response = await db.from("sessions").insert({ name: item.name, starts_on: item.startsOn, ends_on: item.endsOn }).select("id,name,is_current,starts_on,ends_on").single();
    error = response.error; saved = response.data;
  } else if (item.action === "term") {
    const response = await db.from("terms").insert({ session_id: item.sessionId, name: item.name }).select("id,session_id,name,is_current").single();
    error = response.error; saved = response.data;
  } else if (item.action === "section") {
    const response = await db.from("school_sections").insert({ division_id: divisionId, name: item.name }).select("id,division_id,name").single();
    error = response.error; saved = response.data;
  } else if (item.action === "class") {
    if (item.sectionId) {
      const { data: section } = await db.from("school_sections").select("id").eq("id", item.sectionId).eq("division_id", divisionId).maybeSingle();
      if (!section) return NextResponse.json({ error: "Choose an education level in this division." }, { status: 400 });
    }
    const response = await db.from("classes").insert({ division_id: divisionId, section_id: item.sectionId, name: item.name, sort_order: item.sortOrder }).select("id,division_id,section_id,name,sort_order").single();
    error = response.error; saved = response.data;
  } else if (item.action === "arm") {
    const { data: schoolClass } = await db.from("classes").select("id").eq("id", item.classId).eq("division_id", divisionId).maybeSingle();
    if (!schoolClass) return NextResponse.json({ error: "Choose a class in this division." }, { status: 400 });
    const response = await db.from("class_arms").insert({ class_id: item.classId, name: item.name }).select("id,class_id,name").single();
    error = response.error; saved = response.data;
  } else if (item.action === "subject") {
    const response = await db.from("subjects").insert({ division_id: divisionId, code: item.code.toUpperCase(), name: item.name }).select("id,division_id,code,name,is_active").single();
    error = response.error; saved = response.data;
  } else {
    const response = await db.rpc("upwa_set_current_academic_period", { p_session_id: item.sessionId, p_term_id: item.termId });
    error = response.error;
  }

  if (error) {
    const duplicate = error.code === "23505";
    return NextResponse.json({ error: duplicate ? "That name or code is already in use." : "The academic setup change could not be saved. Confirm the migration is applied and try again." }, { status: duplicate ? 409 : 403 });
  }
  return NextResponse.json({ saved: saved ?? true }, { status: 201 });
}
