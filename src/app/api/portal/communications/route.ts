import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const EVENTS = ["RESULT_PUBLISHED", "PAYMENT_CONFIRMED", "ABSENCE", "ADMISSION_UPDATE", "URGENT_NOTICE", "CARE_UPDATE"] as const;
export async function GET(request: NextRequest) {
  const result = await requirePortalAccess(request.nextUrl.searchParams.get("division") || "ALL", ["parent.read"]);
  if (!result.ok) return result.response;
  const { data: guardian, error: guardianError } = await result.access.supabase.from("guardians").select("id,email,email_verified_at,phone,phone_verified_at").eq("user_id", result.access.user.id).maybeSingle();
  if (guardianError || !guardian) return NextResponse.json({ error: "A linked guardian profile is required." }, { status: 403 });
  const [links, preferences] = await Promise.all([
    result.access.supabase.from("student_guardians").select("student_id,relationship,students(admission_number,first_name,last_name,current_division_id)").eq("guardian_id", guardian.id),
    result.access.supabase.from("communication_preferences").select("student_id,event_type,email_enabled,sms_enabled,whatsapp_enabled,updated_at").eq("guardian_id", guardian.id),
  ]);
  if (links.error || preferences.error) return NextResponse.json({ error: "Communication settings are unavailable." }, { status: 503 });
  return NextResponse.json({ guardian: { email: guardian.email, emailVerified: Boolean(guardian.email_verified_at), phone: guardian.phone, phoneVerified: Boolean(guardian.phone_verified_at) }, children: links.data ?? [], preferences: preferences.data ?? [], events: EVENTS });
}
const Input = z.object({ division: z.string(), studentId: z.string().uuid(), eventType: z.enum(EVENTS), emailEnabled: z.boolean(), smsEnabled: z.boolean(), whatsappEnabled: z.boolean() });
export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid communication preference." }, { status: 400 }); }
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose valid channel preferences." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["parent.read"]);
  if (!result.ok) return result.response;
  const { data: guardian } = await result.access.supabase.from("guardians").select("id,email_verified_at,phone_verified_at").eq("user_id", result.access.user.id).maybeSingle();
  if (!guardian) return NextResponse.json({ error: "A linked guardian profile is required." }, { status: 403 });
  const { error } = await result.access.supabase.from("communication_preferences").upsert({ guardian_id: guardian.id, student_id: parsed.data.studentId, event_type: parsed.data.eventType, email_enabled: parsed.data.emailEnabled && Boolean(guardian.email_verified_at), sms_enabled: parsed.data.smsEnabled && Boolean(guardian.phone_verified_at), whatsapp_enabled: parsed.data.whatsappEnabled && Boolean(guardian.phone_verified_at), updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "Preferences could not be saved. Verify a channel before opting in." }, { status: 403 });
  return NextResponse.json({ saved: true });
}
