"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!configured) {
      setError("Secure sign-in is not configured. Contact the UPWA system administrator.");
      return;
    }

    setBusy(true);
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);

    if (signInError) {
      setError("Sign-in failed. Check your email and password, or contact an authorised UPWA administrator.");
      return;
    }
    router.replace("/portal");
    router.refresh();
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
        <p className="mt-3 text-sm leading-6 text-slate-600">Use the email and personal password linked to your existing UPWA account.</p>

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
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="-mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-upwa-blue-500 focus:ring-2 focus:ring-upwa-blue-100"
            required
          />
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
          <div className="-mt-3 flex w-full rounded-xl border border-slate-300 focus-within:border-upwa-blue-500 focus-within:ring-2 focus-within:ring-upwa-blue-100">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-sm outline-none"
              required
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="rounded-r-xl px-3 text-slate-500 hover:bg-slate-50 hover:text-upwa-navy focus:outline-none focus:ring-2 focus:ring-inset focus:ring-upwa-blue-500">
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
          <button disabled={!configured || busy} className="w-full rounded-xl bg-upwa-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-upwa-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <Link href="/reset-password" className="mt-4 inline-block text-sm font-medium text-upwa-blue-700 underline">Set or reset your personal password</Link>
        <p className="mt-6 text-xs leading-5 text-slate-500">Each staff member must use their own account. Never share passwords; individual accounts let the school audit who accessed the portal.</p>
        <Link href="/" className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-upwa-navy hover:bg-slate-50">← Back to home</Link>
      </section>
    </main>
  );
}
