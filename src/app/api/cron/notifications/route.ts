import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const runtime = "nodejs";
function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(secret && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret)));
}
async function deliver(channel: string, item: { id: string; recipient: string; subject: string | null; body: string; attempt: number }) {
  if (channel === "EMAIL") {
    const apiKey = process.env.RESEND_API_KEY; const from = process.env.NOTIFICATION_FROM_EMAIL;
    if (!apiKey || !from) return { provider: "RESEND", success: false, error: "Email provider is not configured." };
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "Idempotency-Key": `${item.id}-${item.attempt}` }, body: JSON.stringify({ from, to: [item.recipient], subject: item.subject ?? "UPWA school update", text: item.body }), cache: "no-store" });
    const result = await response.json().catch(() => null);
    return { provider: "RESEND", success: response.ok && Boolean(result?.id), messageId: result?.id, error: response.ok ? null : JSON.stringify(result).slice(0, 700), errorCode: String(response.status) };
  }
  if (channel === "SMS") {
    const sid = process.env.TWILIO_ACCOUNT_SID; const token = process.env.TWILIO_AUTH_TOKEN; const from = process.env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) return { provider: "TWILIO_SMS", success: false, error: "SMS provider is not configured." };
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ To: item.recipient, From: from, Body: item.body });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: "POST", headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
    const result = await response.json().catch(() => null);
    return { provider: "TWILIO_SMS", success: response.ok && Boolean(result?.sid), messageId: result?.sid, error: response.ok ? null : String(result?.message ?? "SMS provider rejected the request").slice(0, 700), errorCode: String(result?.code ?? response.status) };
  }
  if (channel === "WHATSAPP") {
    const token = process.env.WHATSAPP_ACCESS_TOKEN; const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID; const template = process.env.WHATSAPP_TEMPLATE_NAME; const version = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v21.0";
    if (!token || !phoneId || !template) return { provider: "WHATSAPP_CLOUD_API", success: false, error: "Official WhatsApp Business Cloud API template is not configured." };
    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneId)}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: item.recipient.replace(/\D/g, ""), type: "template", template: { name: template, language: { code: "en" } } }), cache: "no-store" });
    const result = await response.json().catch(() => null);
    return { provider: "WHATSAPP_CLOUD_API", success: response.ok && Boolean(result?.messages?.[0]?.id), messageId: result?.messages?.[0]?.id, error: response.ok ? null : String(result?.error?.message ?? "WhatsApp provider rejected the request").slice(0, 700), errorCode: String(result?.error?.code ?? response.status) };
  }
  return { provider: "UNKNOWN", success: false, error: "Unsupported communication channel." };
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "Scheduled job authentication required." }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !url || !serviceKey) return NextResponse.json({ error: "Notification queue is not configured." }, { status: 503 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.from("notification_outbox").select("id,channel,recipient,subject,body,attempt_count").in("status", ["PENDING", "FAILED"]).lt("attempt_count", 5).lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(50);
  if (error) return NextResponse.json({ error: "Notification queue could not be read." }, { status: 503 });
  let sent = 0; let failed = 0; let skipped = 0;
  for (const row of rows ?? []) {
    const { data: claim, error: claimError } = await admin.rpc("upwa_claim_notification", { p_notification_id: row.id });
    if (claimError || !claim) { skipped++; continue; }
    const item = { ...claim, attempt: Number(claim.attempt ?? row.attempt_count + 1) };
    let result: Awaited<ReturnType<typeof deliver>>;
    try { result = await deliver(item.channel, item); }
    catch (error) { result = { provider: item.channel, success: false, error: error instanceof Error ? error.message.slice(0, 700) : "Provider request failed" }; }
    const { error: logError } = await admin.rpc("upwa_notification_attempt", { p_notification_id: item.id, p_provider: result.provider, p_success: result.success, p_message_id: result.messageId ?? null, p_error_code: result.errorCode ?? null, p_error_message: result.error ?? null });
    if (logError) failed++;
    else if (result.success) sent++;
    else failed++;
  }
  return NextResponse.json({ queued: rows?.length ?? 0, sent, failed, skipped });
}
export const POST = GET;
