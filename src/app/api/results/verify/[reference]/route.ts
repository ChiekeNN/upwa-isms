import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function GET(_request: Request, context: { params: Promise<{ reference: string }> }) {
  const { reference } = await context.params;
  if (!/^UPWA-[A-F0-9]{24}$/.test(reference)) return NextResponse.json({ status: "NOT_FOUND", valid: false }, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signingKey = process.env.REPORT_SIGNING_KEY;
  if (!isSupabaseConfigured() || !url || !serviceKey || !signingKey) return NextResponse.json({ status: "UNAVAILABLE", valid: false }, { status: 503 });
  const admin = createSupabaseClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: record, error } = await admin.from("report_verification").select("id,document_reference,student_id,session_id,term_id,version,hmac_signature,status,issuer,issued_at").eq("document_reference", reference).maybeSingle();
  if (error) return NextResponse.json({ status: "UNAVAILABLE", valid: false }, { status: 503 });
  if (!record) return NextResponse.json({ status: "NOT_FOUND", valid: false }, { status: 404 });
  const { data: report, error: snapshotError } = await admin.from("report_card_snapshots").select("snapshot").eq("verification_id", record.id).maybeSingle();
  if (snapshotError || !report?.snapshot) return NextResponse.json({ status: "INVALID", valid: false }, { status: 200 });
  const hash = createHash("sha256").update(stableJson(report.snapshot)).digest("hex");
  const payload = `${record.document_reference}|${record.student_id}|${record.session_id}|${record.term_id}|${record.version}|${hash}`;
  const expected = createHmac("sha256", signingKey).update(payload).digest();
  const stored = /^[a-f0-9]{64}$/i.test(record.hmac_signature) ? Buffer.from(record.hmac_signature, "hex") : Buffer.alloc(0);
  const signatureMatches = stored.length === expected.length && timingSafeEqual(stored, expected);
  if (!signatureMatches) return NextResponse.json({ status: "INVALID_SIGNATURE", valid: false, reference }, { status: 200 });
  const status = record.status === "VALID" ? "VALID" : record.status === "SUPERSEDED" ? "SUPERSEDED" : "REVOKED";
  return NextResponse.json({ status, valid: status === "VALID", reference, issuer: record.issuer, version: record.version, issuedAt: record.issued_at });
}
