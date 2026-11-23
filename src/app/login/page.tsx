"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!configured) {
      setError("Secure sign-in is not configured. Contact the UPWA system administrator.");
      return;
    }
    const value = email.trim();
    if (!value) return;

    setBusy(true);
    const supabase = createClient();
    const result = await supabase.auth.signInWithOtp({
      email: value,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);

    if (result.error) {
      // Keep account existence private; never confirm whether an address is registered.
      setMessage("If this email is linked to an active UPWA account, a secure sign-in link will be sent.");
      return;
    }
    setMessage("Check your email for the secure sign-in link. Use only the address linked to your school account.");
  }

  return (
    <main className="min-h-screen bg-upwa-canvas px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <Link href="/" className="inline-flex items-center gap-3 mb-8">
          <Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-14 w-12 object-contain" />
          <span className="font-semibold text-upwa-navy">UPWA International Schools</span>
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-upwa-blue-700">Secure school access</p>
        <h1 className="mt-2 text-2xl font-bold text-upwa-navy">Sign in to the school portal</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use the email address already linked to your UPWA account. A one-time sign-in link will be sent to that address.
        </p>

        {!configured && (
          <div role="status" className="mt-5 rounded-xl border border-upwa-orange-200 bg-upwa-orange-50 p-4 text-sm text-upwa-orange-900">
            Secure sign-in is unavailable until the Supabase URL and public key are configured.
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
            required
          />
          <button disabled={!configured || busy} className="w-full rounded-xl bg-upwa-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-upwa-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Sending secure sign-in…" : "Send one-time sign-in"}
          </button>
        </form>
        {message && <p role="status" className="mt-4 rounded-xl bg-upwa-green-50 p-3 text-sm text-upwa-green-800">{message}</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Parents and guardians sign in through an email address they control that is linked to their account. Student IDs and phone numbers are never accepted as proof of identity.
        </p>
      </section>
    </main>
  );
}
