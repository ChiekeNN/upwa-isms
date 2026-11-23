import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const ContentType = z.enum(["PAGE", "NEWS", "EVENT", "GALLERY", "CAMPUS_TOUR", "FACILITY", "ACADEMIC_OFFERING", "ACHIEVEMENT", "LEADERSHIP_NOTE", "CALENDAR"]);
const ContentInput = z.object({
  contentType: ContentType,
  divisionId: z.string().uuid().nullable().optional(),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(500).optional().default(""),
  body: z.record(z.unknown()).optional().default({}),
  seoTitle: z.string().trim().max(180).optional().default(""),
  seoDescription: z.string().trim().max(320).optional().default(""),
});

export async function GET() {
  const result = await requirePortalAccess("*", ["cms.manage"]);
  if (!result.ok) return result.response;
  const { data, error } = await result.access.supabase
    .from("cms_entries")
    .select("id, content_type, division_id, slug, title, summary, body, status, seo_title, seo_description, is_placeholder, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Could not load authorised website content." }, { status: 503 });
  return NextResponse.json({ entries: data ?? [] });
}

export async function POST(request: NextRequest) {
  const result = await requirePortalAccess("*", ["cms.manage"]);
  if (!result.ok) return result.response;
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "A valid content entry is required." }, { status: 400 });
  }
  const parsed = ContentInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the content fields and try again." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await result.access.supabase
    .from("cms_entries")
    .insert({
      content_type: input.contentType,
      division_id: input.divisionId ?? null,
      slug: input.slug,
      title: input.title,
      summary: input.summary || null,
      body: input.body,
      status: "DRAFT",
      seo_title: input.seoTitle || null,
      seo_description: input.seoDescription || null,
      created_by: result.access.user.id,
      updated_by: result.access.user.id,
    })
    .select("id, content_type, division_id, slug, title, status, updated_at")
    .single();
  if (error) return NextResponse.json({ error: "Content could not be saved. Confirm your division publishing permission." }, { status: 403 });
  return NextResponse.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const result = await requirePortalAccess("*", ["cms.manage"]);
  if (!result.ok) return result.response;
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "A valid content update is required." }, { status: 400 });
  }
  const schema = z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(180).optional(),
    summary: z.string().trim().max(500).nullable().optional(),
    body: z.record(z.unknown()).optional(),
    seoTitle: z.string().trim().max(180).nullable().optional(),
    seoDescription: z.string().trim().max(320).nullable().optional(),
    status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]).optional(),
    isPlaceholder: z.boolean().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the content update and try again." }, { status: 400 });
  const { id, ...input } = parsed.data;
  const patch: Record<string, unknown> = { updated_by: result.access.user.id, updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.body !== undefined) patch.body = input.body;
  if (input.seoTitle !== undefined) patch.seo_title = input.seoTitle;
  if (input.seoDescription !== undefined) patch.seo_description = input.seoDescription;
  if (input.status !== undefined) {
    patch.status = input.status;
    patch.published_at = input.status === "PUBLISHED" ? new Date().toISOString() : null;
  }
  if (input.isPlaceholder !== undefined) patch.is_placeholder = input.isPlaceholder;
  const { data, error } = await result.access.supabase
    .from("cms_entries")
    .update(patch)
    .eq("id", id)
    .select("id, content_type, division_id, slug, title, status, updated_at")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Content could not be updated for your assigned scope." }, { status: 403 });
  return NextResponse.json({ entry: data });
}
