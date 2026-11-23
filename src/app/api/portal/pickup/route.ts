import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalAccess } from "@/lib/auth/portal-access";

const Input = z.object({ division: z.string(), studentId: z.string().uuid(), collectorName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(80), expiresAt: z.string().datetime() });
export async function GET(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["parent.read"]);
  if (!result.ok) return result.response;
  const [{ data, error }, { data: guardian }] = await Promise.all([
    result.access.supabase.from("pickup_authorisations").select("id,student_id,collector_name,relationship,expires_at,is_active,created_at,photo_storage_path").order("created_at", { ascending: false }).limit(100),
    result.access.supabase.from("guardians").select("id").eq("user_id", result.access.user.id).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: "Pickup authorisations are unavailable." }, { status: 503 });
  let children: {id:string;admission_number:string;first_name:string;last_name:string}[]=[];
  if(guardian){const [links,primary]=await Promise.all([result.access.supabase.from("student_guardians").select("student_id,can_authorize_pickup").eq("guardian_id",guardian.id).eq("can_authorize_pickup",true),result.access.supabase.from("school_divisions").select("id").eq("code","PRIMARY_EARLY_YEARS").maybeSingle()]);const studentIds=(links.data??[]).map((row)=>row.student_id);if(primary.data&&studentIds.length){const pupils=await result.access.supabase.from("students").select("id,admission_number,first_name,last_name").in("id",studentIds).eq("current_division_id",primary.data.id);children=pupils.data??[];}}
  const auths = await Promise.all((data ?? []).map(async (row) => {
    const { data: signed } = await result.access.supabase.storage.from("upwa-pickup-photos").createSignedUrl(row.photo_storage_path, 90);
    return { ...row, photoUrl: signed?.signedUrl ?? null, photo_storage_path: undefined };
  }));
  return NextResponse.json({ children, authorisations: auths });
}
export async function POST(request: NextRequest) {
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const result = await requirePortalAccess(division, ["parent.read"]);
  if (!result.ok) return result.response;
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "A pickup person form is required." }, { status: 400 });
  const parsed = Input.safeParse({ division, studentId: form.get("studentId"), collectorName: form.get("collectorName"), relationship: form.get("relationship"), expiresAt: form.get("expiresAt") });
  const file = form.get("photo");
  if (!parsed.success || !(file instanceof File)) return NextResponse.json({ error: "Enter a name, relationship, expiry and photo." }, { status: 400 });
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : null;
  if (!ext || file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Pickup photo must be JPEG or PNG up to 5 MB." }, { status: 400 });
  const path = `${parsed.data.studentId}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await result.access.supabase.storage.from("upwa-pickup-photos").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Private photo upload failed. Please retry." }, { status: 503 });
  const { data, error } = await result.access.supabase.rpc("upwa_create_pickup_authorisation", { p_student_id: parsed.data.studentId, p_name: parsed.data.collectorName, p_relationship: parsed.data.relationship, p_photo_path: path, p_expires_at: parsed.data.expiresAt });
  if (error) { await result.access.supabase.storage.from("upwa-pickup-photos").remove([path]); return NextResponse.json({ error: "Only a pickup-authorised guardian can add a person for a Primary / Early Years pupil." }, { status: 403 }); }
  return NextResponse.json({ id: data }, { status: 201 });
}
export async function PATCH(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid revocation request." }, { status: 400 }); }
  const parsed = z.object({ division: z.string(), authorisationId: z.string().uuid() }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid authorisation." }, { status: 400 });
  const result = await requirePortalAccess(parsed.data.division, ["parent.read"]);
  if (!result.ok) return result.response;
  const { error } = await result.access.supabase.rpc("upwa_revoke_pickup_authorisation", { p_authorisation_id: parsed.data.authorisationId });
  if (error) return NextResponse.json({ error: "This pickup person could not be revoked." }, { status: 403 });
  return NextResponse.json({ revoked: true });
}
