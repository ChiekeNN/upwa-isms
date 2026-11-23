"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"loading" | "request" | "update">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setMode(data.session ? "update" : "request"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const supabase = createClient();
    if (mode === "request") {
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setBusy(false);
      setMessage("If this email belongs to an existing UPWA account, password setup instructions will be sent.");
      if (requestError) setError("Password reset could not be requested. Contact an authorised UPWA administrator.");
      return;
    }
    if (password.length < 12) { setBusy(false); setError("Use at least 12 characters for your new password."); return; }
    if (password !== confirm) { setBusy(false); setError("The passwords do not match."); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError("Password could not be updated. Request a fresh reset link and try again."); return; }
    router.replace("/portal"); router.refresh();
  }

  return <main className="min-h-screen bg-upwa-canvas px-4 py-12 flex items-center justify-center"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-upwa-blue-700">Secure account access</p><h1 className="mt-2 text-2xl font-bold text-upwa-navy">{mode === "update" ? "Choose your personal password" : "Set or reset your password"}</h1>{mode === "loading" ? <p className="mt-4 text-sm text-slate-600">Checking your secure reset link…</p> : <form onSubmit={submit} className="mt-6 space-y-4">{mode === "request" ? <><p className="text-sm text-slate-600">Enter the email linked to your existing UPWA account. We’ll send a private password setup link if it is registered.</p><label htmlFor="email" className="block text-sm font-medium">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event)=>setEmail(event.target.value)} className="-mt-3 w-full rounded-xl border px-4 py-3 text-sm"/></> : <><p className="text-sm text-slate-600">Create a password only you know. Use at least 12 characters and do not reuse a shared password.</p><label htmlFor="password" className="block text-sm font-medium">New password</label><input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event)=>setPassword(event.target.value)} className="-mt-3 w-full rounded-xl border px-4 py-3 text-sm"/><label htmlFor="confirm" className="block text-sm font-medium">Confirm new password</label><input id="confirm" type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={(event)=>setConfirm(event.target.value)} className="-mt-3 w-full rounded-xl border px-4 py-3 text-sm"/></>}<button disabled={!isSupabaseConfigured()||busy} className="w-full rounded-xl bg-upwa-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy?"Please wait…":mode==="update"?"Save password":"Send password setup link"}</button></form>}{message&&<p role="status" className="mt-4 rounded-xl bg-upwa-green-50 p-3 text-sm text-upwa-green-800">{message}</p>}{error&&<p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<Link href="/login" className="mt-5 inline-block text-sm text-upwa-blue-700 underline">Back to sign in</Link></section></main>;
}
