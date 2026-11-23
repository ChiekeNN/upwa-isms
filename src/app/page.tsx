import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Camera, GraduationCap, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import PublicUpdates from "@/components/public-updates";
import { INSTITUTION_CONFIG } from "@/config/institution";

const divisions = [
  {
    href: "/schools/primary-early-years",
    name: "Primary / Early Years",
    classes: "Crèche, Nursery and Primary 1–6",
    description: "Explore school-approved information for families considering the Primary and Early Years division.",
    icon: BookOpen,
    accent: "text-upwa-blue-300",
  },
  {
    href: "/schools/secondary",
    name: "Secondary",
    classes: "JSS 1–3 and SSS 1–3",
    description: "Find approved curriculum, calendar, admissions and school updates for the Secondary division.",
    icon: GraduationCap,
    accent: "text-upwa-orange-400",
  },
];

const informationSections = [
  { title: "A welcome from the President", type: "LEADERSHIP_NOTE", description: "The President’s approved welcome will be published here." },
  { title: "Head Teacher and Principal notes", type: "LEADERSHIP_NOTE", description: "Approved messages from school leadership will appear here when supplied." },
  { title: "Our school story", type: "PAGE", description: "The verified school history is being prepared for publication by an authorised editor." },
  { title: "Curriculum and academic offerings", type: "ACADEMIC_OFFERING", description: "Division-specific academic information will be published after school review." },
  { title: "Facilities, clubs and STEM activities", type: "FACILITY", description: "Only confirmed school facilities and activities will be listed here." },
  { title: "Photo galleries and campus tour", type: "GALLERY", description: "Approved photographs and tour material will appear here when provided by the school." },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-upwa-canvas">
      <header className="sticky top-0 z-40 border-t-4 border-t-upwa-orange-500 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/upwa-logo.png" alt="UPWA International Schools official logo" width={180} height={200} priority className="h-12 w-11 shrink-0 object-contain" />
            <span className="truncate text-sm font-bold text-upwa-navy sm:text-base">{INSTITUTION_CONFIG.institutionalWebsiteName}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main navigation">
            <Link href="#schools" className="hidden text-sm font-semibold text-slate-700 hover:text-upwa-blue-700 sm:inline">Our schools</Link>
            <Link href="/admissions" className="rounded-lg px-3 py-2 text-sm font-semibold text-upwa-blue-800 hover:bg-upwa-blue-50">Admissions</Link>
            <Link href="/login" className="rounded-lg bg-upwa-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-upwa-blue-800">Portal sign in</Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-upwa-navy via-upwa-navy to-upwa-blue-950 px-4 py-16 text-white sm:px-6 sm:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full border-[36px] border-upwa-orange-500/15" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-upwa-blue-400/30 bg-upwa-blue-500/10 px-3 py-1 text-xs font-medium text-upwa-blue-200">
              <Sparkles className="h-4 w-4" /> UPWA International Schools
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">A connected school community from Early Years through Secondary.</h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Explore school-approved information, separate division experiences, admissions updates and secure services for authorised families and staff.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/admissions" className="inline-flex items-center gap-2 rounded-xl bg-upwa-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-upwa-blue-500">Admissions enquiry <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"><ShieldCheck className="h-4 w-4" /> Secure portal sign in</Link>
            </div>
          </div>
          <div className="grid gap-4 lg:col-span-5">
            {divisions.map((division) => {
              const Icon = division.icon;
              return <Link href={division.href} key={division.href} className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/25 hover:bg-white/10"><div className="flex items-center justify-between"><span className={`text-xs font-semibold uppercase tracking-wider ${division.accent}`}>{division.name}</span><Icon className={`h-5 w-5 ${division.accent}`} /></div><h2 className="mt-2 text-xl font-bold">{division.classes}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{division.description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white">Explore division <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>;
            })}
          </div>
        </div>
      </section>

      <section id="schools" className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
        <InfoCard icon={<CalendarDays className="h-6 w-6 text-upwa-blue-700" />} title="School calendar" body="Official term dates and events will be published here after review by an authorised school editor." />
        <InfoCard icon={<GraduationCap className="h-6 w-6 text-upwa-orange-600" />} title="School news and achievements" body="Approved school updates, activities and achievements will be shared here when verified and supplied." />
        <InfoCard icon={<MapPin className="h-6 w-6 text-upwa-green-700" />} title="Campus and contact" body="Verified campus information and school contact details will be added by an authorised editor." />
      </section>

      <PublicUpdates />

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-upwa-blue-700">School information</p><h2 className="mt-2 text-2xl font-bold text-upwa-navy">A place for verified school stories</h2><p className="mt-2 text-sm leading-6 text-slate-600">These areas are ready for authorised staff to publish approved information in the school website CMS.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{informationSections.map((section) => <InfoCard key={section.title} icon={section.type === "GALLERY" ? <Camera className="h-5 w-5 text-upwa-blue-700" /> : <BookOpen className="h-5 w-5 text-upwa-blue-700" />} title={section.title} body={section.description} />)}</div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p><strong className="text-slate-700">{INSTITUTION_CONFIG.institutionalWebsiteName}</strong> · {INSTITUTION_CONFIG.officialPlatformFullName}</p>
          <p>{INSTITUTION_CONFIG.technologyCredit}</p>
        </div>
      </footer>
    </main>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-3">{icon}</div><h3 className="text-lg font-bold text-upwa-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></article>;
}
