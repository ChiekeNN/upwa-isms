import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { INSTITUTION_CONFIG } from "@/config/institution";

const EXPLORE_LINKS = [
  { href: "#about", label: "About the school" },
  { href: "#ethos", label: "Vision & mission" },
  { href: "#academics", label: "Academic structure" },
  { href: "#admissions", label: "How to apply" },
  { href: "#news", label: "News & events" },
];

const DIVISION_LINKS = [
  { href: "/schools/primary-early-years", label: "Early Years & Primary", note: "Crèche · Nursery · Primary 1–6" },
  { href: "/schools/secondary", label: "Secondary School", note: "JSS 1–3 · SSS 1–3" },
];

const SERVICE_LINKS = [
  { href: "/admissions", label: "Online admissions" },
  { href: "/portal", label: "Portal demonstration" },
  { href: "/login", label: "Family & staff sign in" },
  { href: "/alumnae", label: "Alumnae & giving" },
];

/** Public website footer with sitemap columns and the institutional credit line. */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="surface-navy relative overflow-hidden text-slate-300">
      <div aria-hidden="true" className="pattern-dots pattern-fade pointer-events-none absolute inset-0 opacity-40" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full border-[40px] border-upwa-orange-500/10"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-white/95 p-2 shadow-panel">
                <Image
                  src="/upwa-logo.png"
                  alt="UPWA International Schools crest"
                  width={180}
                  height={200}
                  className="h-12 w-11 object-contain"
                />
              </span>
              <span>
                <span className="block font-display text-lg font-bold leading-tight text-white">
                  {INSTITUTION_CONFIG.institutionalWebsiteName}
                </span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-brand text-upwa-orange-400">
                  International Group of Schools
                </span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
              An educational institution within the University of Port Harcourt, offering a continuous learning journey
              from crèche and early years through primary, junior and senior secondary education.
            </p>
            <p className="mt-5 flex items-start gap-2.5 text-sm leading-6 text-slate-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-upwa-orange-400" aria-hidden="true" />
              {INSTITUTION_CONFIG.location}
            </p>
            <Link
              href="/admissions"
              className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white"
            >
              <span className="link-sweep">Begin an application</span>
              <ArrowUpRight
                className="h-4 w-4 text-upwa-orange-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>

          {/* Sitemap columns */}
          <nav className="lg:col-span-2" aria-label="Explore">
            <FooterHeading>Explore</FooterHeading>
            <FooterLinks links={EXPLORE_LINKS} />
          </nav>

          <nav className="lg:col-span-3" aria-label="Our schools">
            <FooterHeading>Our schools</FooterHeading>
            <ul className="mt-5 grid gap-3">
              {DIVISION_LINKS.map((division) => (
                <li key={division.href}>
                  <Link
                    href={division.href}
                    className="group block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.09]"
                  >
                    <span className="block text-sm font-semibold text-white">{division.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{division.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="lg:col-span-3" aria-label="Family and staff services">
            <FooterHeading>Family & staff</FooterHeading>
            <FooterLinks links={SERVICE_LINKS} />
            <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs leading-6 text-slate-400">
              Official contact details, term dates and leadership messages are published by authorised school editors
              through the {INSTITUTION_CONFIG.officialShortName} website CMS.
            </p>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-slate-400 lg:flex-row lg:items-center lg:justify-between">
          <p>
            <span className="font-semibold text-slate-200">
              © {year} {INSTITUTION_CONFIG.institutionalWebsiteName}
            </span>
            <span className="px-2 text-white/20" aria-hidden="true">
              |
            </span>
            {INSTITUTION_CONFIG.officialPlatformFullName}
          </p>
          <p className="lg:text-right">{INSTITUTION_CONFIG.technologyCredit}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-brand text-upwa-orange-400">
      <span className="ornament-rule mb-3 block w-8" aria-hidden="true" />
      {children}
    </h2>
  );
}

function FooterLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="mt-5 grid gap-2.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="text-sm text-slate-400 transition-colors duration-200 hover:text-white"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
