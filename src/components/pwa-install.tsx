"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Share, Smartphone, X } from "lucide-react";
import { INSTITUTION_CONFIG } from "@/config/institution";

/**
 * Registers the service worker and offers the install the browser allows.
 *
 * The worker is registered in production builds only: in development the
 * chunks are not content-hashed, and a caching worker would serve yesterday's
 * JavaScript against today's code.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "upwa:install-dismissed";
const VERSION_KEY = "upwa:sw-version";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export default function PwaInstall() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  // window does not exist during prerendering, so this is measured after mount.
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    const onMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; version?: string } | undefined;
      if (payload?.type !== "UPWA_SW_ACTIVATED" || !payload.version) return;
      const previous = window.localStorage.getItem(VERSION_KEY);
      if (previous && previous !== payload.version) setUpdateReady(true);
      window.localStorage.setItem(VERSION_KEY, payload.version);
    };

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A blocked or unsupported registration must never break the site.
    });
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (window.sessionStorage.getItem(DISMISSED_KEY)) return;
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (deferred || isStandalone() || window.sessionStorage.getItem(DISMISSED_KEY)) return;
    if (isIOS()) setIosHint(true);
  }, [deferred]);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
    setDeferred(null);
    setIosHint(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDeferred(null);
    else dismiss();
  };

  if (standalone) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[80] flex w-[min(20rem,calc(100vw_-_2.5rem))] flex-col gap-2.5">
      {updateReady ? (
        <div className="animate-fade-up rounded-2xl border border-upwa-blue-200 bg-white p-4 shadow-panel-lg">
          <p className="flex items-center gap-2 text-[13px] font-bold text-upwa-navy">
            <RefreshCw size={15} className="text-upwa-blue-700" /> A newer version is ready
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {INSTITUTION_CONFIG.officialShortName} has been updated on the server. Reload to pick it up.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-upwa-navy px-4 py-2 text-xs font-bold text-white transition hover:bg-upwa-blue-900"
          >
            <RefreshCw size={13} /> Reload now
          </button>
        </div>
      ) : null}

      {deferred ? (
        <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-panel-lg">
          <div className="flex items-start gap-3">
            <img src="/icons/icon-96.png" alt="" width={44} height={44} className="shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-upwa-navy">
                <Smartphone size={14} className="text-upwa-orange-500" /> Install {INSTITUTION_CONFIG.officialShortName}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Keep the school on your home screen. It opens like an app and the pages you use keep working offline.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={install}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-upwa-orange-500 px-4 py-2.5 text-xs font-bold text-upwa-midnight shadow-panel transition hover:bg-upwa-orange-400"
          >
            <Download size={14} /> Install the app
          </button>
        </div>
      ) : null}

      {!deferred && iosHint ? (
        <div className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-4 shadow-panel-lg">
          <div className="flex items-start gap-3">
            <Share size={16} className="mt-0.5 shrink-0 text-upwa-blue-700" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-upwa-navy">Add to Home Screen</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Tap the Share button in Safari, then choose “Add to Home Screen” to keep {INSTITUTION_CONFIG.officialShortName} on
                your iPhone or iPad.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install hint"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
