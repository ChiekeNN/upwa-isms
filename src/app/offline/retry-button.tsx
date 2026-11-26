"use client";

import { RefreshCw } from "lucide-react";

/** Reload lives in a client island: the page itself carries server metadata. */
export default function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex items-center gap-2 rounded-xl bg-upwa-orange-500 px-5 py-2.5 text-sm font-bold text-upwa-midnight shadow-panel transition hover:bg-upwa-orange-400"
    >
      <RefreshCw size={15} /> Try again
    </button>
  );
}
