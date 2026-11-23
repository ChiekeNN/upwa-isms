import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/portal-access";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const division = request.nextUrl.searchParams.get("division") || "ALL";
  const accessResult = await requirePortalAccess(division, ["admissions.manage"]);
  if (!accessResult.ok) return accessResult.response;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !key) return NextResponse.json({ error: "Private document access is not configured." }, { status: 503 });

  const { data, error } = await accessResult.access.supabase
    .from("admission_documents")
    .select("id, document_type, storage_path, uploaded_at")
    .eq("application_id", id)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load authorised application documents." }, { status: 403 });

  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const documents = await Promise.all((data ?? []).map(async (document) => {
    const { data: signed, error: signError } = await admin.storage.from("upwa-admission-documents").createSignedUrl(document.storage_path, 60);
    return signError || !signed ? null : { id: document.id, type: document.document_type, uploadedAt: document.uploaded_at, url: signed.signedUrl };
  }));
  return NextResponse.json({ documents: documents.filter(Boolean) });
}
