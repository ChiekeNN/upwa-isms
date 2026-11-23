import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?error=sign-in", request.url));
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const next = request.nextUrl.searchParams.get("next");
  const destination = next === "/reset-password" ? "/reset-password" : "/portal";
  return NextResponse.redirect(new URL(error ? "/login?error=sign-in" : destination, request.url));
}
