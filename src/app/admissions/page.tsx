"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type AdmissionOption = {
  cycle_id: string;
  division_code: string;
  division_name: string;
  class_id: string;
  class_name: string;
  session_name: string;
  application_fee_amount: number;
  closes_at: string;
  entrance_exam_at: string | null;
  exam_venue: string | null;
};

type ApplicationReceipt = {
  applicationNumber: string;
  trackingToken: string;
  status: string;
  applicationFeeAmount: number;
  examAt: string | null;
  examVenue: string | null;
};

export default function AdmissionsPage() {
  const [options, setOptions] = useState<AdmissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [trackedApplication, setTrackedApplication] = useState<Record<string, string | null> | null>(null);
  const [trackError, setTrackError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetch("/api/admissions/options")
      .then(async (response) => response.ok ? response.json() : { options: [] })
      .then((result) => {
        setOptions(result.options ?? []);
        setSelectedCycle(result.options?.[0]?.cycle_id ?? "");
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedOption = options.find((option) => option.cycle_id === selectedCycle);

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      cycleId: selectedCycle,
      firstName: String(form.get("firstName") ?? ""),
      middleName: String(form.get("middleName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      dateOfBirth: String(form.get("dateOfBirth") ?? ""),
      gender: String(form.get("gender") ?? "") || undefined,
      guardianName: String(form.get("guardianName") ?? ""),
      guardianEmail: String(form.get("guardianEmail") ?? ""),
      guardianPhone: String(form.get("guardianPhone") ?? ""),
    };
    const response = await fetch("/api/admissions/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "The application could not be submitted.");
      return;
    }
    setReceipt(result);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receipt) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("token", receipt.trackingToken);
    setUploadBusy(true);
    setUploadError("");
    setUploadMessage("");
    const response = await fetch("/api/admissions/document", { method: "POST", body: form });
    const result = await response.json();
    setUploadBusy(false);
    if (!response.ok) {
      setUploadError(result.error ?? "The document could not be uploaded.");
      return;
    }
    setUploadMessage(`${result.documentType.replaceAll("_", " ")} uploaded securely.`);
    formElement.reset();
  }

  async function trackApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackError("");
    setTrackedApplication(null);
    const response = await fetch("/api/admissions/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: trackingToken.trim() }),
    });
    const result = await response.json();
    if (!response.ok) {
      setTrackError(result.error ?? "Could not retrieve application status.");
      return;
    }
    setTrackedApplication(result.application);
  }

  return (
    <main className="min-h-screen bg-upwa-canvas px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-12 w-11 object-contain" />
          <span className="font-semibold text-upwa-navy">UPWA International Schools</span>
        </Link>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-upwa-blue-700">Admissions</p>
            <h1 className="mt-2 text-2xl font-bold text-upwa-navy">Online application</h1>
            <p className="mt-2 text-sm text-slate-600">Submit an application only for a school division and admission round currently opened by an authorised UPWA admissions officer.</p>

            {receipt ? (
              <div className="mt-6 rounded-2xl border border-upwa-green-200 bg-upwa-green-50 p-5">
                <h2 className="font-bold text-upwa-green-900">Application received</h2>
                <p className="mt-2 text-sm text-upwa-green-900">Application reference: <strong>{receipt.applicationNumber}</strong></p>
                <p className="mt-3 text-sm font-semibold text-upwa-green-900">Save this private tracking token. It will only be shown once.</p>
                <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs text-slate-800">{receipt.trackingToken}</code>
                <p className="mt-3 text-xs text-slate-600">Keep the token private; the reference number alone cannot retrieve the applicant’s status.</p>
                {receipt.examAt && <p className="mt-3 text-sm">Exam schedule: {new Date(receipt.examAt).toLocaleString()} {receipt.examVenue ? `· ${receipt.examVenue}` : ""}</p>}
                {receipt.applicationFeeAmount > 0 && <p className="mt-2 text-sm">Configured application fee: ₦{Number(receipt.applicationFeeAmount).toLocaleString("en-NG")}. The school will provide approved payment instructions.</p>}
                <form onSubmit={uploadDocument} className="mt-5 border-t border-upwa-green-200 pt-4">
                  <h3 className="text-sm font-semibold text-upwa-green-900">Upload supporting documents</h3>
                  <p className="mt-1 text-xs text-slate-600">Private uploads are limited to JPEG, PNG or PDF files up to 10 MB.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-600">Document type<select name="documentType" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="PASSPORT">Passport photo</option><option value="BIRTH_CERTIFICATE">Birth certificate</option><option value="PREVIOUS_REPORT">Previous report</option><option value="OTHER">Other</option></select></label>
                    <label className="text-xs font-semibold text-slate-600">File<input name="file" type="file" accept="image/jpeg,image/png,application/pdf" required className="mt-1 block w-full text-xs" /></label>
                  </div>
                  <button disabled={uploadBusy} className="mt-3 rounded-lg border border-upwa-green-700 px-4 py-2 text-xs font-semibold text-upwa-green-900 disabled:opacity-50">{uploadBusy ? "Uploading securely…" : "Upload document"}</button>
                  {uploadError && <p role="alert" className="mt-2 text-xs text-rose-700">{uploadError}</p>}
                  {uploadMessage && <p role="status" className="mt-2 text-xs text-upwa-green-800">{uploadMessage}</p>}
                </form>
              </div>
            ) : loading ? (
              <p className="mt-6 text-sm text-slate-600">Checking current admission rounds…</p>
            ) : options.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-upwa-orange-200 bg-upwa-orange-50 p-5 text-sm text-upwa-orange-900">
                Applications are not open yet. An authorised school officer must configure and publish an admission round before the form is enabled.
              </div>
            ) : (
              <form onSubmit={submitApplication} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-slate-700">Division and entry class
                  <select value={selectedCycle} onChange={(event) => setSelectedCycle(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                    {options.map((option) => <option value={option.cycle_id} key={option.cycle_id}>{option.division_name} · {option.class_name} · {option.session_name}</option>)}
                  </select>
                </label>
                {selectedOption && <p className="-mt-2 text-xs text-slate-500">Application closes {new Date(selectedOption.closes_at).toLocaleDateString()} {selectedOption.application_fee_amount > 0 ? `· Fee ₦${Number(selectedOption.application_fee_amount).toLocaleString("en-NG")}` : "· No application fee configured"}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">First name<input name="firstName" required maxLength={80} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Middle name <span className="font-normal text-slate-500">(optional)</span><input name="middleName" maxLength={80} autoComplete="additional-name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Last name<input name="lastName" required maxLength={80} autoComplete="family-name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Date of birth<input name="dateOfBirth" type="date" required max={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Gender <span className="font-normal text-slate-500">(optional)</span><select name="gender" defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="UNSPECIFIED">Unspecified</option></select></label>
                  <label className="text-sm font-medium text-slate-700">Parent / guardian name<input name="guardianName" required maxLength={120} autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Guardian email <span className="font-normal text-slate-500">(optional)</span><input name="guardianEmail" type="email" maxLength={254} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                  <label className="text-sm font-medium text-slate-700">Guardian phone<input name="guardianPhone" required maxLength={24} autoComplete="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
                </div>
                {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
                <button disabled={busy || !selectedCycle} className="rounded-xl bg-upwa-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-upwa-blue-800 disabled:opacity-50">{busy ? "Submitting…" : "Submit application"}</button>
                <p className="text-xs text-slate-500">Do not submit identity documents through this form. Secure document upload will be provided by the school after your application is received.</p>
              </form>
            )}
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-upwa-navy">Track an application</h2>
              <p className="mt-2 text-sm text-slate-600">Use the private token shown once after submission. A name, student ID, phone number, or application reference alone cannot unlock status information.</p>
              <form onSubmit={trackApplication} className="mt-4 space-y-3">
                <label htmlFor="trackingToken" className="sr-only">Secure tracking token</label>
                <input id="trackingToken" value={trackingToken} onChange={(event) => setTrackingToken(event.target.value)} minLength={32} maxLength={128} required placeholder="Paste secure tracking token" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
                <button className="w-full rounded-xl border border-upwa-blue-700 px-4 py-2.5 text-sm font-semibold text-upwa-blue-800 hover:bg-upwa-blue-50">Check status</button>
              </form>
              {trackError && <p role="alert" className="mt-3 text-sm text-rose-700">{trackError}</p>}
              {trackedApplication && <div className="mt-4 rounded-xl bg-upwa-blue-50 p-4 text-sm"><p>Reference: <strong>{trackedApplication.application_number}</strong></p><p className="mt-1">Status: <strong>{String(trackedApplication.status).replaceAll("_", " ")}</strong></p>{trackedApplication.exam_at && <p className="mt-1">Exam: {new Date(trackedApplication.exam_at).toLocaleString()}</p>}</div>}
            </section>
            <section className="rounded-3xl bg-upwa-navy p-6 text-white">
              <h2 className="font-bold">Need help?</h2>
              <p className="mt-2 text-sm text-slate-200">Contact the school through its verified published contact details. Contact information will appear here once approved in the school website CMS.</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
