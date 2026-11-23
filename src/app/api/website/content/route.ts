import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ entries: [] });
  const divisionCode = request.nextUrl.searchParams.get("division");
  const supabase = await createServerSupabaseClient();
  let divisionId: string | null = null;
  if (divisionCode) {
    const { data: division } = await supabase.from("school_divisions").select("id").eq("code", divisionCode).maybeSingle();
    if (!division) return NextResponse.json({ entries: [] });
    divisionId = division.id;
  }

  const requestedTypes = request.nextUrl.searchParams.get("type")?.split(",").filter(Boolean);
  const allowedTypes = ["PAGE", "NEWS", "EVENT", "GALLERY", "CAMPUS_TOUR", "FACILITY", "ACADEMIC_OFFERING", "ACHIEVEMENT", "LEADERSHIP_NOTE", "CALENDAR", "ALUMNAE", "SCHOLARSHIP", "DEVELOPMENT_PROJECT", "DONATION_CAMPAIGN"];
  const types = requestedTypes?.filter((type) => allowedTypes.includes(type.toUpperCase())).map((type) => type.toUpperCase());
  let query = supabase
    .from("cms_entries")
    .select("id, content_type, division_id, slug, title, summary, body, media_paths, seo_title, seo_description, published_at")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(30);
  if (types?.length) query = query.in("content_type", types);
  if (divisionId) query = query.or(`division_id.eq.${divisionId},division_id.is.null`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ entries: [] });
  return NextResponse.json({ entries: data ?? [] });
}
