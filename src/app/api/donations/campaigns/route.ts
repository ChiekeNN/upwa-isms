import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ campaigns: [] });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("donation_campaigns").select("id,campaign_code,title,purpose,target_amount,currency").eq("is_published",true).eq("is_active",true).order("created_at",{ascending:false}).limit(30);
  if (error) return NextResponse.json({ error: "Approved campaigns are temporarily unavailable." },{status:503});
  return NextResponse.json({ campaigns:data??[] });
}
