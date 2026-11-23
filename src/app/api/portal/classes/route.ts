import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["academics.read", "registry.manage", "admissions.manage"]);
  if (!result.ok) return result.response;
  let query = result.access.supabase.from("classes").select("id, division_id, name, sort_order").order("sort_order").order("name");
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load classes for this role." }, { status: 503 });
  return NextResponse.json({ classes: data ?? [] });
}
