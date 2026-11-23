import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["registry.manage"]);
  if (!result.ok) return result.response;
  let query = result.access.supabase
    .from("staff_profiles")
    .select("id, staff_number, full_name, division_id, position_title, employment_status, subjects, started_on, ended_on")
    .order("full_name")
    .limit(500);
  if (result.access.divisionId) query = query.eq("division_id", result.access.divisionId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load authorised staff profiles." }, { status: 503 });
  return NextResponse.json({ staff: data ?? [] });
}

const StaffInput = z.object({
  division: z.enum(["PRIMARY_EARLY_YEARS", "SECONDARY"]),
  staffNumber: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9/-]+$/),
  fullName: z.string().trim().min(2).max(160),
  positionTitle: z.string().trim().max(120).optional().default(""),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "ENDED"]).default("ACTIVE"),
  subjects: z.array(z.string().trim().min(1).max(100)).max(30).optional().default([]),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "A valid staff profile is required." }, { status: 400 });
  }
  const parsed = StaffInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Check the staff profile fields and try again." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["registry.manage"]);
  if (!result.ok) return result.response;
  if (!result.access.divisionId) return NextResponse.json({ error: "Choose a division." }, { status: 400 });

  const { data, error } = await result.access.supabase
    .from("staff_profiles")
    .insert({
      staff_number: parsed.data.staffNumber,
      full_name: parsed.data.fullName,
      division_id: result.access.divisionId,
      position_title: parsed.data.positionTitle || null,
      employment_status: parsed.data.employmentStatus,
      subjects: parsed.data.subjects,
    })
    .select("id, staff_number, full_name, division_id, position_title, employment_status, subjects")
    .single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That staff number already exists in the registry." : "The profile could not be saved for this division." }, { status: error.code === "23505" ? 409 : 403 });
  return NextResponse.json({ staff: data }, { status: 201 });
}
