import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const ApplicationInput = z.object({
  cycleId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]).optional(),
  guardianName: z.string().trim().min(2).max(120),
  guardianEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""),
  guardianPhone: z.string().trim().min(7).max(24),
});

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Admissions are not available until the school database is configured." }, { status: 503 });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid application form is required." }, { status: 400 });
  }
  const parsed = ApplicationInput.safeParse(raw);
  if (!parsed.success || new Date(parsed.data?.dateOfBirth ?? "invalid") >= new Date()) {
    return NextResponse.json({ error: "Check the applicant details and try again." }, { status: 400 });
  }

  const token = randomBytes(32).toString("base64url");
  const supabase = await createServerSupabaseClient();
  const input = parsed.data;
  const { data, error } = await supabase.rpc("upwa_submit_application", {
    p_cycle_id: input.cycleId,
    p_first_name: input.firstName,
    p_middle_name: input.middleName || null,
    p_last_name: input.lastName,
    p_date_of_birth: input.dateOfBirth,
    p_gender: input.gender ?? null,
    p_guardian_name: input.guardianName,
    p_guardian_email: input.guardianEmail || null,
    p_guardian_phone: input.guardianPhone,
    p_tracking_token: token,
  });
  if (error) {
    const duplicate = error.message.toLowerCase().includes("duplicate");
    return NextResponse.json(
      { error: duplicate ? "A possible duplicate application already exists. Contact the school admissions officer if this is a different applicant." : "This application round is not open or the submitted details could not be accepted." },
      { status: duplicate ? 409 : 400 }
    );
  }
  const application = Array.isArray(data) ? data[0] : data;
  if (!application?.application_number) {
    return NextResponse.json({ error: "The application could not be confirmed. Please contact the school." }, { status: 503 });
  }
  return NextResponse.json({
    applicationNumber: application.application_number,
    trackingToken: token,
    status: application.status,
    applicationFeeAmount: application.application_fee_amount,
    examAt: application.entrance_exam_at,
    examVenue: application.exam_venue,
  }, { status: 201 });
}
