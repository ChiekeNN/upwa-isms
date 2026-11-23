import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";
  const secret = process.env.PAYSTACK_SECRET_KEY || "";

  if (!secret) {
    return NextResponse.json(
      { error: "Paystack credentials not configured" },
      { status: 503 }
    );
  }

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // TODO: Persist event.data.reference into `gateway_webhook_events` with a UNIQUE constraint
  // to guarantee idempotent processing and prevent duplicate e-receipt issuance.
  return NextResponse.json({
    received: true,
    eventType: event?.event ?? "unknown",
    reference: event?.data?.reference ?? null,
  });
}
