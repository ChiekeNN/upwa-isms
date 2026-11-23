import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const TrackInput = z.object({ token: z.string().min(32).max(128) });

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Application tracking is not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Enter the secure application tracking token." }, { status: 400 });
  }
  const parsed = TrackInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter the secure application tracking token." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("upwa_track_application", { p_token: parsed.data.token });
  if (error) return NextResponse.json({ error: "Application status is temporarily unavailable." }, { status: 503 });
  const application = Array.isArray(data) ? data[0] : data;
  if (!application) return NextResponse.json({ error: "No application matched that secure tracking token." }, { status: 404 });
  return NextResponse.json({ application });
}
