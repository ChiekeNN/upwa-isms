import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import RetryButton from "./retry-button";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `You are offline | ${INSTITUTION_CONFIG.officialShortName}`,
  robots: { index: false, follow: false },
};

/**
 * The page the service worker shows when the network is gone and the page she
 * asked for was never cached. Pages she has already opened keep working; this
 * is only for the ones she has not.
 */
export default function OfflinePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-upwa-midnight via-upwa-navy to-upwa-blue-900 px-6 text-white">
      <div aria-hidden="true" className="pattern-grid pattern-fade pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-upwa-orange-500/10 blur-3xl" />
      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-panel-lg backdrop-blur-sm">
        <img
          src="/icons/icon-192.png"
          alt={`${INSTITUTION_CONFIG.officialShortName} crest`}
          width={88}
          height={88}
          className="mx-auto rounded-2xl shadow-panel-lg"
        />
        <p className="mt-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-upwa-orange-300">
          <WifiOff size={14} /> No connection
        </p>
        <h1 className="mt-3 font-display text-2xl font-black leading-tight">The network is away, but the app is still here</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {INSTITUTION_CONFIG.officialShortName} keeps the pages you have already opened on this device, so you can keep reading them
          without a connection. This particular page has not been saved yet.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <RetryButton />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Saved pages
          </Link>
        </div>
        <p className="mt-6 text-[11px] leading-5 text-slate-400">
          {INSTITUTION_CONFIG.technologyCredit}
        </p>
      </section>
    </main>
  );
}
