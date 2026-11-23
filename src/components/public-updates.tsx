"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; content_type: string; title: string; summary: string | null; published_at: string | null };

export default function PublicUpdates() {
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    fetch("/api/website/content?type=NEWS,EVENT,ACHIEVEMENT", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { entries: [] })
      .then((result) => setEntries(result.entries ?? []))
      .catch(() => setEntries([]));
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-upwa-blue-700">School updates</p><h2 className="mt-1 text-xl font-bold text-upwa-navy">Approved news and events</h2></div>
          <p className="text-xs text-slate-500">Published by authorised school editors</p>
        </div>
        {entries.length === 0 ? (
          <p className="mt-4 rounded-xl bg-upwa-orange-50 p-4 text-sm text-upwa-orange-900">No approved news or events have been published yet. This section will update when verified school content is approved.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{entries.slice(0, 6).map((entry) => <article key={entry.id} className="rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-semibold uppercase text-upwa-blue-700">{entry.content_type.replaceAll("_", " ")}</p><h3 className="mt-1 font-semibold text-upwa-navy">{entry.title}</h3>{entry.summary && <p className="mt-2 text-sm text-slate-600">{entry.summary}</p>}{entry.published_at && <time className="mt-3 block text-xs text-slate-400" dateTime={entry.published_at}>{new Date(entry.published_at).toLocaleDateString()}</time>}</article>)}</div>
        )}
      </div>
    </section>
  );
}
