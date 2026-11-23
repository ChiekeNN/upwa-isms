import { INSTITUTION_CONFIG } from "@/config/institution";

export default async function VerifyReportPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          {INSTITUTION_CONFIG.officialShortName} Cryptographic Document Check
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {INSTITUTION_CONFIG.institutionalWebsiteName}
        </h1>
        <p className="text-xs text-slate-600">
          Verification Reference: <span className="font-mono font-bold">{reference}</span>
        </p>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          Connect Supabase `report_verification` table in Sprint 3 to validate live issuance status (`valid`, `revoked`, `superseded`, or `not found`).
        </div>
        <p className="text-[11px] text-slate-400">{INSTITUTION_CONFIG.technologyCredit}</p>
      </div>
    </div>
  );
}
