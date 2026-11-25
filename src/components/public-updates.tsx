import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, Newspaper, Trophy } from "lucide-react";
import Reveal from "@/components/site/reveal";
import SectionHeading from "@/components/site/section-heading";

export type PublicContentEntry = {
  id: string;
  content_type: string;
  title: string;
  summary: string | null;
  published_at: string | null;
};

const TYPE_META: Record<string, { label: string; badge: string; ring: string }> = {
  NEWS: {
    label: "News",
    badge: "bg-upwa-blue-50 text-upwa-blue-800",
    ring: "group-hover:border-upwa-blue-200",
  },
  EVENT: {
    label: "Event",
    badge: "bg-upwa-green-50 text-upwa-green-800",
    ring: "group-hover:border-upwa-green-200",
  },
  ACHIEVEMENT: {
    label: "Achievement",
    badge: "bg-upwa-orange-50 text-upwa-orange-800",
    ring: "group-hover:border-upwa-orange-200",
  },
};

const FALLBACK_META = { label: "Update", badge: "bg-slate-100 text-slate-700", ring: "group-hover:border-slate-300" };

function formatPublishedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Approved school news, events and achievements. Content is supplied by the
 * server from published CMS entries only; when nothing has been approved yet the
 * section presents a designed holding state rather than an empty box.
 */
export default function PublicUpdates({ entries = [] }: { entries?: PublicContentEntry[] }) {
  const latest = entries.slice(0, 6);
  const [featured, ...rest] = latest;

  return (
    <section id="news" className="surface-ivory relative scroll-mt-32 px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <SectionHeading
            eyebrow="Newsroom"
            title="News, events & achievements"
            lede="Announcements published by authorised school editors. Only approved content reaches the public website."
            action={
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-upwa-canvas px-4 py-2 text-xs font-semibold text-slate-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-upwa-green-600" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-upwa-green-600" />
                </span>
                Published by authorised editors
              </span>
            }
          />
        </Reveal>

        {latest.length === 0 ? (
          <Reveal delay={80}>
            <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-upwa-canvas/60">
              <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-12 lg:items-center lg:gap-12">
                <div className="lg:col-span-7">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-upwa-blue-700 shadow-panel">
                    <Newspaper className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-bold text-upwa-navy sm:text-3xl">
                    The school newsroom is ready and waiting
                  </h3>
                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                    Term announcements, event notices and student achievements appear here as soon as an authorised UPWA
                    editor reviews and publishes them. Nothing is published on the school&apos;s behalf without
                    approval, so this space stays accurate to what the school has confirmed.
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {[
                      { label: "News", icon: Newspaper },
                      { label: "Events", icon: CalendarDays },
                      { label: "Achievements", icon: Trophy },
                    ].map((item) => (
                      <li
                        key={item.label}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                      >
                        <item.icon className="h-3.5 w-3.5 text-upwa-blue-700" aria-hidden="true" />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:col-span-5">
                  <div className="panel p-7">
                    <p className="eyebrow text-upwa-blue-700">
                      <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                      For school editors
                    </p>
                    <p className="mt-4 font-display text-lg font-semibold leading-snug text-upwa-navy">
                      Publish an update from the website CMS
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Draft, review and publish news, events and achievements from the content workspace. Published
                      entries flow straight to this page and to each division micro-portal.
                    </p>
                    <Link href="/portal" className="btn-navy mt-6 w-full">
                      Open the portal demo <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ) : (
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {featured ? (
              <Reveal className="lg:col-span-2" delay={60}>
                <NewsCard entry={featured} featured />
              </Reveal>
            ) : null}
            <div className="grid gap-5">
              {(rest.length ? rest : []).map((entry, index) => (
                <Reveal key={entry.id} delay={120 + index * 70}>
                  <NewsCard entry={entry} compact />
                </Reveal>
              ))}
              {rest.length === 0 ? (
                <Reveal delay={140}>
                  <div className="panel panel-hover flex h-full flex-col justify-center p-7">
                    <p className="font-display text-lg font-semibold text-upwa-navy">More updates coming</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Further approved announcements will be listed here as editors publish them.
                    </p>
                  </div>
                </Reveal>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function NewsCard({
  entry,
  featured = false,
  compact = false,
}: {
  entry: PublicContentEntry;
  featured?: boolean;
  compact?: boolean;
}) {
  const meta = TYPE_META[entry.content_type] ?? FALLBACK_META;
  const publishedAt = formatPublishedAt(entry.published_at);

  return (
    <article
      className={`panel panel-hover group flex h-full flex-col overflow-hidden ${
        meta.ring
      } ${featured ? "p-8 sm:p-10" : compact ? "p-6" : "p-7"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.badge}`}>
          {meta.label}
        </span>
        {publishedAt ? (
          <time dateTime={entry.published_at ?? undefined} className="text-xs font-medium text-slate-500">
            {publishedAt}
          </time>
        ) : null}
      </div>
      <h3
        className={`mt-4 font-display font-bold leading-snug text-upwa-navy ${
          featured ? "text-2xl sm:text-3xl" : "text-lg"
        }`}
      >
        {entry.title}
      </h3>
      {entry.summary ? (
        <p className={`mt-3 leading-7 text-slate-600 ${featured ? "text-base" : "text-sm"}`}>{entry.summary}</p>
      ) : null}
      {featured ? (
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-upwa-blue-700">
          Read the announcement
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </span>
      ) : null}
    </article>
  );
}
