import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const DocumentType = z.enum(["PASSPORT", "BIRTH_CERTIFICATE", "PREVIOUS_REPORT", "OTHER"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !serviceKey) {
    return NextResponse.json({ error: "Secure document upload is not configured." }, { status: 503 });
  }
  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "A valid upload form is required." }, { status: 400 });
  }
  const token = String(form.get("token") ?? "");
  const type = DocumentType.safeParse(form.get("documentType"));
  const file = form.get("file");
  if (token.length < 32 || token.length > 128 || !type.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Choose a document type and a valid file." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES || !["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    return NextResponse.json({ error: "Upload a JPEG, PNG or PDF file up to 10 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatureMatches = file.type === "application/pdf"
    ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    : file.type === "image/png"
      ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!signatureMatches) return NextResponse.json({ error: "The file content does not match its declared type." }, { status: 400 });

  const publicClient = await createServerSupabaseClient();
  const { data: applicationData, error: applicationError } = await publicClient.rpc("upwa_application_for_upload", { p_token: token });
  const application = Array.isArray(applicationData) ? applicationData[0] : applicationData;
  if (applicationError || !application?.application_id) {
    return NextResponse.json({ error: "The tracking token is invalid or its document-upload window has closed." }, { status: 404 });
  }

  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "pdf";
  const path = `${application.application_id}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await admin.storage.from("upwa-admission-documents").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "The document could not be stored securely." }, { status: 503 });

  const { data: documentId, error: recordError } = await publicClient.rpc("upwa_record_admission_document", {
    p_token: token,
    p_document_type: type.data,
    p_storage_path: path,
  });
  if (recordError || !documentId) {
    await admin.storage.from("upwa-admission-documents").remove([path]);
    return NextResponse.json({ error: "The document could not be attached to this application." }, { status: 400 });
  }
  return NextResponse.json({ documentId, documentType: type.data }, { status: 201 });
}
