import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ options: [], configured: false });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("upwa_public_admission_options");
  if (error) return NextResponse.json({ error: "Admissions are not configured yet." }, { status: 503 });
  return NextResponse.json({ options: data ?? [], configured: true });
}
