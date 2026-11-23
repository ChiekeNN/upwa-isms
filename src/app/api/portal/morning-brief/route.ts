import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const accessResult = await requirePortalAccess(division, ["executive.read"]);
  if (!accessResult.ok) return accessResult.response;
  const { access } = accessResult;
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6)).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);
  const [brief, schedules] = await Promise.all([
    access.supabase.rpc("upwa_morning_brief", { p_division_id: access.divisionId, p_from: from, p_to: to }),
    access.supabase.from("executive_brief_schedules").select("id,frequency,is_active,next_run_at,division_id").eq("owner_id", access.user.id),
  ]);
  if (brief.error || schedules.error) return NextResponse.json({ error: "The executive brief could not be loaded. Apply the approved operations migration." }, { status: 503 });
  return NextResponse.json({ title: "President’s Morning Brief", divisionId: access.divisionId, period: { from, to }, report: brief.data ?? {}, schedules: schedules.data ?? [] });
}

const Input = z.object({ division: z.string(), frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]), active: z.boolean().default(true) });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid schedule settings." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a daily, weekly or monthly schedule." }, { status: 400 });
  const accessResult = await requirePortalAccess(parsed.data.division, ["executive.read"]);
  if (!accessResult.ok) return accessResult.response;
  const { data, error } = await accessResult.access.supabase.rpc("upwa_save_brief_schedule", {
    p_frequency: parsed.data.frequency,
    p_division_id: accessResult.access.divisionId,
    p_active: parsed.data.active,
  });
  if (error) return NextResponse.json({ error: "A verified executive email and authorised division are required to schedule delivery." }, { status: 403 });
  return NextResponse.json({ scheduleId: data, message: "Schedule saved. Email delivery runs only to your verified account email." });
}
