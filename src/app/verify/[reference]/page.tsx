"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";
import { INSTITUTION_CONFIG } from "@/config/institution";

type Verification = { status: string; valid: boolean; reference?: string; issuer?: string; version?: number; issuedAt?: string };
export default function VerifyReportPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [result, setResult] = useState<Verification | null>(null);
  useEffect(() => { fetch(`/api/results/verify/${encodeURIComponent(reference)}`, { cache: "no-store" }).then((response) => response.json()).then(setResult).catch(() => setResult({ status: "UNAVAILABLE", valid: false })); }, [reference]);
  const label = result?.status === "VALID" ? "Valid and current" : result?.status === "SUPERSEDED" ? "Superseded by a newer issue" : result?.status === "REVOKED" ? "Revoked" : result?.status === "NOT_FOUND" ? "Reference not found" : result?.status === "INVALID_SIGNATURE" || result?.status === "INVALID" ? "Signature could not be verified" : result?.status === "UNAVAILABLE" ? "Verification service unavailable" : "Checking signature…";
  return <main className="flex min-h-screen items-center justify-center bg-upwa-canvas p-6"><section className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><Image src="/upwa-logo.png" alt="UPWA International Schools logo" width={180} height={200} className="h-24 w-auto object-contain"/><p className="text-xs font-semibold uppercase tracking-wider text-upwa-blue-700">Secure result document check</p><h1 className="text-2xl font-bold text-upwa-navy">{INSTITUTION_CONFIG.institutionalWebsiteName}</h1><p className="text-sm text-slate-600">Reference <span className="font-mono font-semibold">{reference}</span></p><div className={`rounded-xl border p-4 text-sm font-semibold ${result?.valid ? "border-upwa-green-200 bg-upwa-green-50 text-upwa-green-900" : "border-upwa-orange-200 bg-upwa-orange-50 text-upwa-orange-900"}`} role="status">{label}</div>{result?.issuer && <dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Issuer</dt><dd className="text-right">{result.issuer}</dd><dt className="text-slate-500">Document version</dt><dd className="text-right">{result.version}</dd><dt className="text-slate-500">Issued</dt><dd className="text-right">{result.issuedAt ? new Date(result.issuedAt).toLocaleDateString() : "—"}</dd></dl>}<p className="text-xs leading-5 text-slate-500">This page verifies the signature and current issuance status only. It does not reveal student identity or transcript details.</p></section></main>;
}
