import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Entry = {
  id: string;
  content_type: string;
  title: string;
  summary: string | null;
  body: Record<string, unknown>;
  media_paths: string[];
  published_at: string | null;
};

const DIVISIONS: Record<string, { code: string; name: string; classes: string }> = {
  "primary-early-years": { code: "PRIMARY_EARLY_YEARS", name: "Primary / Early Years", classes: "Crèche, Nursery and Primary 1–6" },
  secondary: { code: "SECONDARY", name: "Secondary", classes: "JSS 1–3 and SSS 1–3" },
};

export default async function SchoolMicroPortal({ params }: { params: Promise<{ division: string }> }) {
  const { division: slug } = await params;
  const config = DIVISIONS[slug];
  if (!config) notFound();

  let entries: Entry[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data: division } = await supabase.from("school_divisions").select("id").eq("code", config.code).maybeSingle();
    if (division) {
      const { data } = await supabase
        .from("cms_entries")
        .select("id, content_type, title, summary, body, media_paths, published_at")
        .eq("status", "PUBLISHED")
        .or(`division_id.eq.${division.id},division_id.is.null`)
        .order("published_at", { ascending: false })
        .limit(40);
      entries = (data ?? []) as Entry[];
    }
  }

  return (
    <main className="min-h-screen bg-upwa-canvas">
      <header className="border-t-4 border-t-upwa-orange-500 bg-upwa-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3"><Image src="/upwa-logo.png" alt="UPWA International Schools" width={180} height={200} className="h-12 w-11 object-contain" /><span className="font-bold">UPWA International Schools</span></Link>
          <Link href="/login" className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10">Portal sign in</Link>
        </div>
      </header>
      <section className="bg-gradient-to-br from-upwa-navy via-upwa-navy to-upwa-blue-950 px-4 py-14 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-upwa-orange-400">School micro-portal</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">{config.name}</h1>
          <p className="mt-4 text-lg text-slate-200">{config.classes}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">School-approved curriculum, calendar, leadership messages, facilities and activities will be published here by authorised editors.</p>
          <Link href="/admissions" className="mt-6 inline-flex rounded-xl bg-upwa-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-upwa-blue-500">Admissions information</Link>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-upwa-orange-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-upwa-navy">School content awaiting approval</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">This section is ready for the school&apos;s verified history, leadership notes, academic offerings, school calendar, facilities, clubs, achievements, news, approved galleries and campus-tour material. No institutional facts or images have been invented.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">{entries.map((entry) => <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-upwa-blue-700">{entry.content_type.replaceAll("_", " ")}</p><h2 className="mt-2 text-xl font-bold text-upwa-navy">{entry.title}</h2>{entry.summary && <p className="mt-2 text-sm text-slate-600">{entry.summary}</p>}<SafeBody body={entry.body} />{entry.published_at && <time dateTime={entry.published_at} className="mt-4 block text-xs text-slate-400">{new Date(entry.published_at).toLocaleDateString()}</time>}</article>)}</div>
        )}
      </section>
      <footer className="border-t border-slate-200 bg-white py-6"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:px-6"><span>{config.name} · UPWA International Schools</span><Link href="/" className="font-semibold text-upwa-blue-700">Home</Link></div></footer>
    </main>
  );
}

function SafeBody({ body }: { body: Record<string, unknown> }) {
  const text = typeof body.text === "string" ? body.text : "";
  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs.filter((item): item is string => typeof item === "string") : [];
  if (!text && paragraphs.length === 0) return null;
  return <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{text && <p>{text}</p>}{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>;
}
