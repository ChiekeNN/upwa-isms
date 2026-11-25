import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  Baby,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Compass,
  FlaskConical,
  GraduationCap,
  Heart,
  Lightbulb,
  MapPin,
  Quote,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import PublicUpdates, { type PublicContentEntry } from "@/components/public-updates";
import Reveal from "@/components/site/reveal";
import SectionHeading from "@/components/site/section-heading";
import SiteFooter from "@/components/site/site-footer";
import SiteHeader from "@/components/site/site-header";
import { INSTITUTION_CONFIG } from "@/config/institution";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `${INSTITUTION_CONFIG.institutionalWebsiteName} | Crèche, Nursery, Primary & Secondary · Choba, Port Harcourt`,
  description:
    "UPWA International Group of Schools, within the University of Port Harcourt, Choba, Rivers State. A continuous learning journey from crèche and early years through primary, junior and senior secondary education.",
  alternates: { canonical: "/" },
};

/* ------------------------------------------------------------------ *
 * Verified institutional content.
 * Everything below is drawn from the school's approved configuration,
 * published history and the live admissions/portal workflows in this
 * codebase. No enrolment figures, awards, staff names or photographs
 * are invented — CMS-owned areas render a designed holding state until
 * an authorised school editor publishes them.
 * ------------------------------------------------------------------ */

const HERO_FACTS = [
  { value: "Two", label: "Divisions", note: "Early Years & Primary · Secondary" },
  { value: "Five", label: "Sections", note: "Crèche through Senior Secondary" },
  { value: "2020", label: "Secondary inaugurated", note: "Junior & senior secondary opened" },
  { value: "2024", label: "Pioneer graduation", note: "First senior secondary cohort" },
];

const DIVISIONS = [
  {
    href: "/schools/primary-early-years",
    code: "PRIMARY_EARLY_YEARS" as const,
    divisionLabel: INSTITUTION_CONFIG.divisions.PRIMARY_EARLY_YEARS.name,
    name: INSTITUTION_CONFIG.divisions.PRIMARY_EARLY_YEARS.shortName,
    classes: "Crèche, Nursery and Primary 1–6",
    sections: INSTITUTION_CONFIG.divisions.PRIMARY_EARLY_YEARS.sections,
    headTitle: INSTITUTION_CONFIG.divisions.PRIMARY_EARLY_YEARS.headTitle,
    description:
      "A nurturing start where early care, school readiness and core literacy and numeracy grow together — with families able to follow attendance, learning and school information from one account.",
    icon: Sprout,
    accent: "text-upwa-blue-600",
    accentSoft: "bg-upwa-blue-50",
    border: "hover:border-upwa-blue-300",
    dot: "bg-upwa-blue-500",
  },
  {
    href: "/schools/secondary",
    code: "SECONDARY" as const,
    divisionLabel: INSTITUTION_CONFIG.divisions.SECONDARY.name,
    name: INSTITUTION_CONFIG.divisions.SECONDARY.shortName,
    classes: "JSS 1–3 and SSS 1–3",
    sections: INSTITUTION_CONFIG.divisions.SECONDARY.sections,
    headTitle: INSTITUTION_CONFIG.divisions.SECONDARY.headTitle,
    description:
      "Broad-based junior secondary learning leading into senior subject pathways, external examinations and preparation for tertiary admission.",
    icon: GraduationCap,
    accent: "text-upwa-orange-700",
    accentSoft: "bg-upwa-orange-50",
    border: "hover:border-upwa-orange-300",
    dot: "bg-upwa-orange-500",
  },
];

const ACADEMIC_PATHWAY = [
  {
    stage: "Crèche & daycare",
    band: "Early care",
    focus: "Child supervision and early care in a safe, settled setting.",
    icon: Baby,
  },
  {
    stage: "Pre-nursery & nursery",
    band: "Foundation",
    focus: "Early childhood learning and school readiness.",
    icon: Sprout,
  },
  {
    stage: "Primary 1–6",
    band: "Core",
    focus: "Literacy, numeracy, foundational subjects and social development.",
    icon: BookOpen,
  },
  {
    stage: "Junior Secondary",
    band: "JSS 1–3",
    focus: "Broad-based secondary learning and junior-level examinations.",
    icon: Compass,
  },
  {
    stage: "Senior Secondary",
    band: "SSS 1–3",
    focus: "Senior subject pathways, external examinations and tertiary preparation.",
    icon: GraduationCap,
  },
];

const VALUES = [
  {
    title: "Creativity",
    source: "“Creativity unto greatness”",
    body: "Pupils are encouraged to think, make and question — treating creativity as the route to greatness rather than an extra-curricular addition.",
    icon: Lightbulb,
  },
  {
    title: "Moral excellence",
    source: "“…attaining moral and academic excellence”",
    body: "Character is developed alongside academics, so young minds grow with the values they will carry beyond the classroom.",
    icon: Heart,
  },
  {
    title: "Academic excellence",
    source: "“…moral and academic excellence”",
    body: "A structured progression from early years to senior secondary examinations, with results families can verify directly with the school.",
    icon: Award,
  },
  {
    title: "Leadership",
    source: "“…raise people that can lead excellently”",
    body: "The school's stated aim is to raise young people prepared to lead excellently in their communities and professions.",
    icon: Star,
  },
];

const ADMISSION_STEPS = [
  {
    title: "Choose an open admission round",
    body: "Select the division, class and session currently accepting applications. Each round publishes its own closing date, application fee and entrance examination details.",
  },
  {
    title: "Complete the online application",
    body: "Enter the applicant's details together with a parent or guardian name, phone number and email address.",
  },
  {
    title: "Receive your reference and token",
    body: "The system issues an application number and a private tracking token. The token is shown once — keep it safely, as it is required to view status.",
  },
  {
    title: "Upload supporting documents",
    body: "Attach the documents the school requests against your application reference, at any time after submitting.",
  },
  {
    title: "Track the review pipeline",
    body: "Follow the application status and see the entrance examination date and venue once the school confirms them.",
  },
];

const CAMPUS_CATEGORIES = [
  { title: "School calendar & term dates", type: "CALENDAR", icon: CalendarDays },
  { title: "Facilities & learning spaces", type: "FACILITY", icon: Building2 },
  { title: "Clubs, STEM & creativity", type: "FACILITY", icon: FlaskConical },
  { title: "Photo galleries", type: "GALLERY", icon: Camera },
  { title: "Campus tour", type: "CAMPUS_TOUR", icon: MapPin },
  { title: "Student achievements", type: "ACHIEVEMENT", icon: Trophy },
];

const PLATFORM_SERVICES = [
  {
    title: "Family portal",
    body: "A family view of learning and school information — attendance, results, communications and invoices for authorised parents and guardians.",
    href: "/portal",
    cta: "See the family view",
    icon: Users,
  },
  {
    title: "Staff & academic workspace",
    body: "Academic structure, records and reporting for authorised teachers, class handlers and administrators — sessions, classes, subjects and assessment.",
    href: "/portal",
    cta: "See the staff view",
    icon: Briefcase,
  },
  {
    title: "Secure result verification",
    body: "Term reports carry a verification reference, so results can be confirmed directly with the school instead of relying on printed copies alone.",
    href: "/portal",
    cta: "How verification works",
    icon: ShieldCheck,
  },
  {
    title: "Admissions, payments & receipts",
    body: "Apply online, upload documents, settle configured school fees and keep every receipt and evidence record in one authorised account.",
    href: "/admissions",
    cta: "Start an application",
    icon: Wallet,
  },
];

const MILESTONES = [
  {
    marker: "Heritage",
    title: "From a childcare initiative",
    body: "The school grew out of a childcare and early-years education initiative connected to the University of Port Harcourt Women Association.",
  },
  {
    marker: "Growth",
    title: "Into a full basic education institution",
    body: "It developed into an institution offering nursery, primary, junior secondary and senior secondary education with association-led governance.",
  },
  {
    marker: "2020",
    title: "Secondary section inaugurated",
    body: "The secondary section was inaugurated in 2020, extending the school's journey beyond primary education.",
  },
  {
    marker: "2024",
    title: "Pioneer senior secondary graduation",
    body: "The pioneer senior secondary cohort graduated in 2024, completing the school's first full journey to SSS 3.",
  },
];

type CmsRow = PublicContentEntry & {
  body: Record<string, unknown>;
  media_paths: string[];
};

async function loadPublishedEntries(): Promise<CmsRow[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("cms_entries")
      .select("id, content_type, title, summary, body, media_paths, published_at")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(24);
    return (data ?? []) as CmsRow[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const entries = await loadPublishedEntries();
  const news = entries.filter((entry) => ["NEWS", "EVENT", "ACHIEVEMENT"].includes(entry.content_type));
  const leadership = entries.find((entry) => entry.content_type === "LEADERSHIP_NOTE");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-upwa-navy focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <SiteHeader />

      <main id="main-content" className="bg-upwa-canvas">
        {/* ============================= HERO ============================= */}
        <section className="surface-navy relative overflow-hidden text-white">
          <div aria-hidden="true" className="pattern-grid pattern-fade pointer-events-none absolute inset-0 opacity-80" />
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute -right-40 -top-52 h-[38rem] w-[38rem] rounded-full border-[54px] border-upwa-orange-500/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-64 -left-48 h-[40rem] w-[40rem] rounded-full bg-upwa-blue-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-7xl px-4 pb-0 pt-14 sm:px-6 lg:px-8 lg:pt-20">
            <div className="grid items-start gap-14 lg:grid-cols-12 lg:gap-14">
              {/* Narrative */}
              <div className="lg:col-span-7 lg:pt-4">
                <Reveal>
                  <span className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-[11px] font-semibold uppercase tracking-brand text-upwa-blue-200 backdrop-blur-sm">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-upwa-orange-400" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-upwa-orange-500" />
                    </span>
                    University of Port Harcourt · Choba, Rivers State
                  </span>
                </Reveal>

                <Reveal delay={90}>
                  <h1 className="mt-8 font-display text-[2.55rem] font-bold leading-[1.04] tracking-tight text-shadow-hero sm:text-6xl lg:text-[4.05rem]">
                    Nurturing young minds into{" "}
                    <span className="accent-underline italic text-upwa-orange-200">moral and academic</span> excellence.
                  </h1>
                </Reveal>

                <Reveal delay={170}>
                  <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg sm:leading-8">
                    UPWA International Group of Schools offers one continuous learning journey — crèche, nursery,
                    primary, junior secondary and senior secondary — governed by the University of Port Harcourt Women
                    Association and supported by a single secure platform for families and staff.
                  </p>
                </Reveal>

                <Reveal delay={250}>
                  <div className="mt-9 flex flex-wrap items-center gap-3">
                    <Link href="/admissions" className="btn-primary">
                      Begin an application
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href="#schools" className="btn-ghost-light">
                      Explore our schools
                    </Link>
                    <Link
                      href="/portal"
                      className="group inline-flex items-center gap-1.5 px-2 py-3.5 text-sm font-semibold text-upwa-blue-200 transition-colors hover:text-white"
                    >
                      <span className="link-sweep">View the portal demo</span>
                      <ArrowUpRight
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                </Reveal>

                {leadership ? (
                  <Reveal delay={320}>
                    <figure className="glass mt-10 max-w-xl p-6">
                      <Quote className="h-5 w-5 text-upwa-orange-400" aria-hidden="true" />
                      <blockquote className="mt-3 font-display text-lg italic leading-relaxed text-white">
                        “{leadership.title}”
                      </blockquote>
                      {leadership.summary ? (
                        <figcaption className="mt-3 text-sm text-slate-300">{leadership.summary}</figcaption>
                      ) : null}
                    </figure>
                  </Reveal>
                ) : null}
              </div>

              {/* Emblem + division switcher */}
              <div className="grid gap-5 lg:col-span-5">
                <Reveal delay={140}>
                  <div className="glass relative overflow-hidden px-8 py-10 text-center">
                    <div aria-hidden="true" className="pattern-dots pointer-events-none absolute inset-0 opacity-30" />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-upwa-orange-500/10 blur-2xl"
                    />
                    <div className="relative">
                      <span className="inline-block rounded-[1.75rem] bg-white p-4 shadow-panel-lg">
                        <Image
                          src="/upwa-logo.png"
                          alt="UPWA International Schools crest"
                          width={180}
                          height={200}
                          priority
                          className="h-24 w-[5.4rem] object-contain"
                        />
                      </span>
                      <p className="mt-6 font-display text-xl font-bold leading-tight text-white">
                        {INSTITUTION_CONFIG.institutionalWebsiteName}
                      </p>
                      <span className="ornament-rule mx-auto mt-4 block w-16" aria-hidden="true" />
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-brand text-upwa-orange-400">
                        International Group of Schools
                      </p>
                      <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-slate-300">
                        Association-led governance on a university campus, with Nigerian and international curricular
                        approaches.
                      </p>
                    </div>
                  </div>
                </Reveal>

                <Reveal delay={220}>
                  <div className="glass p-2.5">
                    <p className="px-3.5 pb-2 pt-2.5 text-[11px] font-bold uppercase tracking-brand text-slate-400">
                      Choose a division
                    </p>
                    <ul className="grid gap-2">
                      {DIVISIONS.map((division) => (
                        <li key={division.code}>
                          <Link
                            href={division.href}
                            className="group flex items-center gap-4 rounded-xl border border-transparent bg-white/[0.04] px-3.5 py-3.5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.1]"
                          >
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors duration-300 group-hover:bg-upwa-orange-500 group-hover:text-upwa-midnight">
                              <division.icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-white">{division.name}</span>
                              <span className="mt-0.5 block truncate text-xs text-slate-400">{division.classes}</span>
                            </span>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
            </div>

            {/* Fact strip */}
            <Reveal delay={300}>
              <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.12] bg-white/10 lg:grid-cols-4">
                {HERO_FACTS.map((fact) => (
                  <div key={fact.label} className="bg-upwa-navy/70 px-6 py-6 backdrop-blur-sm">
                    <dt className="font-display text-3xl font-bold text-white">{fact.value}</dt>
                    <dd className="mt-1.5">
                      <span className="block text-[11px] font-bold uppercase tracking-brand text-upwa-orange-400">
                        {fact.label}
                      </span>
                      <span className="mt-1.5 block text-xs leading-5 text-slate-400">{fact.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          {/* Bottom fade into the page */}
          <div aria-hidden="true" className="h-16 bg-gradient-to-b from-transparent to-upwa-canvas lg:h-20" />
        </section>

        {/* ============================= ABOUT ============================= */}
        <section id="about" className="relative scroll-mt-32 bg-upwa-canvas px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <Reveal>
                  <SectionHeading
                    eyebrow="About the school"
                    title="Rooted in care, growing through education"
                  />
                </Reveal>
                <Reveal delay={90}>
                  <div className="mt-8 space-y-5 text-base leading-8 text-slate-700">
                    <p>
                      The University of Port Harcourt Women Association (UPWA) International Group of Schools is an
                      educational institution located within the University of Port Harcourt, Choba, Rivers State,
                      Nigeria. It grew from a childcare and early-years education initiative into an institution
                      offering nursery, primary, junior secondary and senior secondary education.
                    </p>
                    <p>
                      Its establishment and development are connected to the University of Port Harcourt Women
                      Association, historically involved in educational, welfare and community-development initiatives.
                      The institution combines association-led governance, a university-campus location and an
                      educational model that publicly describes Nigerian and international curricular approaches.
                    </p>
                    <p className="border-l-2 border-upwa-orange-500 pl-5 font-display text-lg italic leading-8 text-upwa-navy">
                      The secondary section was inaugurated in 2020, and its pioneer senior secondary cohort graduated
                      in 2024.
                    </p>
                  </div>
                </Reveal>

                <Reveal delay={160}>
                  <div className="mt-9 flex flex-wrap gap-3">
                    <Link href="#schools" className="btn-navy">
                      Our two divisions <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href="#ethos" className="btn-outline">
                      Vision & mission
                    </Link>
                  </div>
                </Reveal>
              </div>

              <div className="lg:col-span-5">
                <Reveal delay={120}>
                  <div className="panel relative overflow-hidden p-8 sm:p-9">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-upwa-blue-50"
                    />
                    <div className="relative">
                      <p className="eyebrow text-upwa-blue-700">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Our journey
                      </p>
                      <h3 className="mt-3 font-display text-2xl font-bold text-upwa-navy">Milestones</h3>

                      <ol className="mt-7 space-y-0">
                        {MILESTONES.map((milestone, index) => (
                          <li key={milestone.marker} className="relative flex gap-5 pb-7 last:pb-0">
                            {index < MILESTONES.length - 1 ? (
                              <span
                                aria-hidden="true"
                                className="absolute left-[7px] top-5 h-full w-px bg-gradient-to-b from-upwa-blue-300 to-upwa-blue-100"
                              />
                            ) : null}
                            <span className="relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-upwa-blue-500 bg-white" />
                            <span className="min-w-0">
                              <span className="text-[11px] font-bold uppercase tracking-brand text-upwa-orange-700">
                                {milestone.marker}
                              </span>
                              <span className="mt-1 block font-display text-base font-bold text-upwa-navy">
                                {milestone.title}
                              </span>
                              <span className="mt-1.5 block text-sm leading-6 text-slate-600">{milestone.body}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ============================= ETHOS ============================= */}
        <section id="ethos" className="surface-ivory relative scroll-mt-32 overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div aria-hidden="true" className="pattern-grid-light pattern-fade pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="What guides us"
                title="Vision, mission & the values behind them"
                lede="The school's published vision and mission statements, and the four commitments they set out for every pupil."
                align="center"
              />
            </Reveal>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              <Reveal delay={60}>
                <article className="panel panel-hover relative h-full overflow-hidden p-8 sm:p-10">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-upwa-blue-500 to-upwa-blue-700"
                  />
                  <Quote className="h-8 w-8 text-upwa-blue-200" aria-hidden="true" />
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-brand text-upwa-blue-700">Our vision</p>
                  <blockquote className="mt-4 font-display text-3xl font-bold leading-snug text-upwa-navy sm:text-[2.15rem]">
                    “Creativity unto greatness for excellent.”
                  </blockquote>
                  <p className="mt-5 text-sm leading-7 text-slate-600">
                    A school where imagination and disciplined work are treated as the path to greatness.
                  </p>
                </article>
              </Reveal>

              <Reveal delay={130}>
                <article className="panel panel-hover relative h-full overflow-hidden p-8 sm:p-10">
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-upwa-orange-400 to-upwa-orange-600"
                  />
                  <Quote className="h-8 w-8 text-upwa-orange-200" aria-hidden="true" />
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-brand text-upwa-orange-700">
                    Our mission
                  </p>
                  <blockquote className="mt-4 font-display text-xl font-bold leading-relaxed text-upwa-navy sm:text-2xl">
                    “To develop and Nurture young minds into attaining moral and academic excellence and also to raise
                    people that can lead excellently.”
                  </blockquote>
                </article>
              </Reveal>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((value, index) => (
                <Reveal key={value.title} delay={60 + index * 70}>
                  <article className="panel panel-hover group h-full p-7">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-upwa-canvas text-upwa-blue-700 transition-colors duration-500 group-hover:bg-upwa-navy group-hover:text-white">
                      <value.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 font-display text-lg font-bold text-upwa-navy">{value.title}</h3>
                    <p className="mt-2 text-xs font-semibold italic text-upwa-orange-700">{value.source}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{value.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= SCHOOLS ============================= */}
        <section id="schools" className="relative scroll-mt-32 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Our schools"
                title="Two divisions, one continuous journey"
                lede="Each division has its own leadership, sections and published information — while every pupil's record follows them through one secure platform."
                action={
                  <Link href="#academics" className="btn-outline">
                    See academic structure <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              />
            </Reveal>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              {DIVISIONS.map((division, index) => (
                <Reveal key={division.code} delay={index * 110}>
                  <article
                    className={`panel panel-hover group relative h-full overflow-hidden p-8 sm:p-10 ${division.border}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full ${division.accentSoft} transition-transform duration-700 ease-out-expo group-hover:scale-125`}
                    />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-5">
                        <div>
                          <p className={`text-[11px] font-bold uppercase tracking-brand ${division.accent}`}>
                            {division.divisionLabel}
                          </p>
                          <h3 className="mt-3 font-display text-3xl font-bold leading-tight text-upwa-navy">
                            {division.name}
                          </h3>
                          <p className="mt-2 text-sm font-semibold text-slate-500">{division.classes}</p>
                        </div>
                        <span
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${division.accentSoft} ${division.accent} transition-transform duration-500 ease-out-expo group-hover:-rotate-6`}
                        >
                          <division.icon className="h-7 w-7" aria-hidden="true" />
                        </span>
                      </div>

                      <p className="mt-6 text-sm leading-7 text-slate-600">{division.description}</p>

                      <div className="mt-7 flex flex-wrap gap-2">
                        {division.sections.map((section) => (
                          <span
                            key={section}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-upwa-canvas px-3.5 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${division.dot}`} aria-hidden="true" />
                            {section}
                          </span>
                        ))}
                      </div>

                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Led by the {division.headTitle}
                        </p>
                        <Link
                          href={division.href}
                          className="inline-flex items-center gap-1.5 text-sm font-bold text-upwa-navy transition-colors hover:text-upwa-blue-700"
                        >
                          <span className="link-sweep">Visit division portal</span>
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= ACADEMICS ============================= */}
        <section id="academics" className="surface-navy relative scroll-mt-32 overflow-hidden px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
          <div aria-hidden="true" className="pattern-grid pattern-fade pointer-events-none absolute inset-0 opacity-60" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-upwa-blue-500/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Academic structure"
                title="Five stages from crèche to senior secondary"
                lede="A published progression that carries a pupil from early care through to external examinations and tertiary preparation."
                tone="dark"
              />
            </Reveal>

            <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
              {ACADEMIC_PATHWAY.map((stage, index) => (
                <Reveal as="li" key={stage.stage} delay={index * 90} className="h-full">
                  <div className="glass glass-hover group relative flex h-full flex-col p-6">
                    <span className="absolute right-5 top-5 font-display text-4xl font-bold text-white/10 transition-colors duration-500 group-hover:text-upwa-orange-500/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-upwa-orange-400 transition-colors duration-500 group-hover:bg-upwa-orange-500 group-hover:text-upwa-midnight">
                      <stage.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-5 text-[10px] font-bold uppercase tracking-brand text-upwa-blue-300">
                      {stage.band}
                    </p>
                    <h3 className="mt-2 font-display text-lg font-bold leading-snug text-white">{stage.stage}</h3>
                    <p className="mt-2.5 text-sm leading-6 text-slate-300">{stage.focus}</p>
                    {index < ACADEMIC_PATHWAY.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className="absolute -right-3.5 top-1/2 hidden h-px w-7 bg-gradient-to-r from-white/30 to-transparent lg:block"
                      />
                    ) : null}
                  </div>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={120}>
              <div className="glass mt-8 flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-upwa-orange-500/15 text-upwa-orange-400">
                    <FlaskConical className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-white">
                      Division-specific curriculum detail is published by the school
                    </p>
                    <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">
                      Subjects, class arms, term dates and academic offerings appear on each division portal once an
                      authorised editor has reviewed and published them.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  {DIVISIONS.map((division) => (
                    <Link
                      key={division.code}
                      href={division.href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[0.14]"
                    >
                      {division.name}
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================= ADMISSIONS ============================= */}
        <section id="admissions" className="relative scroll-mt-32 bg-upwa-canvas px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Admissions"
                title="How to apply"
                lede="Applications are submitted online against a published admission round. Each round carries its own closing date, application fee and entrance examination details."
                action={
                  <Link href="/admissions" className="btn-primary">
                    Start an application <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                }
              />
            </Reveal>

            <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {ADMISSION_STEPS.map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 80} className="h-full">
                  <div className="panel panel-hover group flex h-full gap-5 p-7">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-upwa-navy font-display text-base font-bold text-white transition-colors duration-500 group-hover:bg-upwa-orange-500 group-hover:text-upwa-midnight">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <h3 className="font-display text-base font-bold leading-snug text-upwa-navy">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                    </span>
                  </div>
                </Reveal>
              ))}

              <Reveal as="li" delay={400}>
                <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-upwa-navy p-7 text-white shadow-panel">
                  <div
                    aria-hidden="true"
                    className="pattern-dots pointer-events-none absolute inset-0 opacity-40"
                  />
                  <div className="relative">
                    <ShieldCheck className="h-7 w-7 text-upwa-orange-400" aria-hidden="true" />
                    <h3 className="mt-4 font-display text-base font-bold leading-snug">Your tracking token is private</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      A name, student ID, phone number or application reference alone cannot unlock status information —
                      only the private token issued at submission can.
                    </p>
                  </div>
                  <Link
                    href="/admissions"
                    className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-upwa-orange-400"
                  >
                    <span className="link-sweep">Track an application</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </ol>
          </div>
        </section>

        {/* ============================= CAMPUS LIFE ============================= */}
        <section id="campus-life" className="relative scroll-mt-32 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Campus life"
                title="Facilities, clubs, galleries & the school calendar"
                lede="These areas are prepared for the school's own verified material. Authorised editors publish approved content through the website CMS, so nothing appears here until the school has confirmed it."
              />
            </Reveal>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPUS_CATEGORIES.map((category, index) => (
                <Reveal key={category.title} delay={index * 70}>
                  <article className="panel panel-hover group flex h-full flex-col p-7">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-upwa-canvas text-upwa-blue-700 transition-colors duration-500 group-hover:bg-upwa-navy group-hover:text-white">
                        <category.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-upwa-orange-300 bg-upwa-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-upwa-orange-800">
                        Awaiting publication
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-bold leading-snug text-upwa-navy">{category.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Approved {category.type.replaceAll("_", " ").toLowerCase()} material from the school will be
                      listed here once published.
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= NEWS ============================= */}
        <PublicUpdates entries={news} />

        {/* ============================= PLATFORM ============================= */}
        <section id="platform" className="relative scroll-mt-32 bg-upwa-canvas px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <Reveal>
                  <SectionHeading
                    eyebrow={INSTITUTION_CONFIG.officialShortName}
                    title="One platform for the whole school community"
                    lede={INSTITUTION_CONFIG.tagline}
                  />
                </Reveal>
                <Reveal delay={100}>
                  <p className="mt-6 text-base leading-8 text-slate-600">
                    Beyond the public website, the {INSTITUTION_CONFIG.officialPlatformFullName} connects authorised
                    families, teachers and administrators to the same verified records — attendance, results,
                    communications, fees and admissions — with role-based access throughout.
                  </p>
                </Reveal>
                <Reveal delay={170}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/portal" className="btn-navy">
                      Explore the portal demo <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href="/login" className="btn-outline">
                      Family & staff sign in
                    </Link>
                  </div>
                </Reveal>
                <Reveal delay={230}>
                  <p className="mt-7 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-600">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-upwa-green-700" aria-hidden="true" />
                    The portal is a restricted service. Access always requires an authorised account issued by the
                    school; the demonstration workspace is provided so families and staff can see the experience before
                    an account is created.
                  </p>
                </Reveal>
              </div>

              <div className="lg:col-span-7">
                <div className="grid gap-5 sm:grid-cols-2">
                  {PLATFORM_SERVICES.map((service, index) => (
                    <Reveal key={service.title} delay={index * 90}>
                      <Link href={service.href} className="panel panel-hover group flex h-full flex-col p-7">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-upwa-navy text-white transition-colors duration-500 group-hover:bg-upwa-orange-500 group-hover:text-upwa-midnight">
                          <service.icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="mt-5 font-display text-lg font-bold leading-snug text-upwa-navy">
                          {service.title}
                        </h3>
                        <p className="mt-2.5 flex-1 text-sm leading-6 text-slate-600">{service.body}</p>
                        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-upwa-blue-700">
                          <span className="link-sweep">{service.cta}</span>
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
                      </Link>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================= CTA BAND ============================= */}
        <section className="relative overflow-hidden bg-upwa-orange-500 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div aria-hidden="true" className="pattern-dots pointer-events-none absolute inset-0 opacity-25" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border-[36px] border-white/15"
          />
          <div className="relative mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <Reveal className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-brand text-upwa-midnight/70">
                Admissions · {INSTITUTION_CONFIG.institutionalWebsiteName}
              </p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-upwa-midnight sm:text-4xl lg:text-[2.75rem]">
                Give your child a journey that never has to start over.
              </h2>
              <p className="mt-4 text-base leading-7 text-upwa-midnight/80">
                From crèche to senior secondary examinations — one school community, one record, one platform.
              </p>
            </Reveal>
            <Reveal delay={120} className="shrink-0">
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                <Link
                  href="/admissions"
                  className="btn bg-upwa-navy px-8 py-4 text-white shadow-panel-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-upwa-midnight"
                >
                  Begin an application <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/portal"
                  className="btn border border-upwa-midnight/25 bg-white/70 px-8 py-4 text-upwa-midnight backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white"
                >
                  Explore the portal demo
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
