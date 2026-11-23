import crypto from "crypto";

export interface ReportVerificationPayload {
  reference: string;
  studentAdmissionNo: string;
  session: string;
  term: string;
  version: number;
}

export function signReportReference(payload: ReportVerificationPayload): string {
  const secret = process.env.REPORT_VERIFICATION_HMAC_SECRET || "dev-fallback-secret-change-in-prod";
  const canonical = `${payload.reference}|${payload.studentAdmissionNo}|${payload.session}|${payload.term}|v${payload.version}`;
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex").slice(0, 24).toUpperCase();
}

export function verifyReportSignature(payload: ReportVerificationPayload, signature: string): boolean {
  const expected = signReportReference(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toUpperCase()));
}
