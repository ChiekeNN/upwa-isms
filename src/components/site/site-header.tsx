"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, MapPin, Menu, ShieldCheck, X } from "lucide-react";
import { INSTITUTION_CONFIG } from "@/config/institution";

const NAV_LINKS: { href: string; label: string; wideOnly?: boolean }[] = [
  { href: "#about", label: "About" },
  { href: "#schools", label: "Our schools" },
  { href: "#academics", label: "Academics" },
  { href: "#admissions", label: "Admissions" },
  { href: "#campus-life", label: "Campus life", wideOnly: true },
  { href: "#news", label: "News", wideOnly: true },
];

const UTILITY_LINKS = [
  { href: "/portal", label: "Portal demo" },
  { href: "/alumnae", label: "Alumnae & giving" },
];

/**
 * Public website masthead: a collapsing utility bar above a sticky brand bar.
 * The bar condenses once the visitor scrolls so the hero gets the full stage.
 */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50">
      {/* Brand hairline */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full bg-gradient-to-r from-upwa-navy via-upwa-blue-500 to-upwa-orange-500"
      />

      {/* Utility bar — collapses on scroll, hidden on small screens */}
      <div
        className={`hidden overflow-hidden bg-upwa-midnight text-slate-300 transition-all duration-500 ease-out-expo lg:block ${
          scrolled ? "max-h-0 opacity-0" : "max-h-12 opacity-100"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-2.5 text-xs lg:px-8">
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-upwa-orange-400" aria-hidden="true" />
            <span className="text-slate-300">{INSTITUTION_CONFIG.location}</span>
          </p>
          <div className="flex items-center gap-5">
            <span className="hidden items-center gap-1.5 text-slate-400 xl:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-upwa-blue-400" aria-hidden="true" />
              {INSTITUTION_CONFIG.tagline}
            </span>
            <span aria-hidden="true" className="h-3 w-px bg-white/15" />
            {UTILITY_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="link-sweep font-medium text-slate-200 hover:text-white">
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="font-semibold text-upwa-orange-400 hover:text-upwa-orange-200">
              Portal sign in
            </Link>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div
        className={`border-b transition-all duration-500 ease-out-expo ${
          scrolled
            ? "border-slate-200/80 bg-white/90 shadow-panel backdrop-blur-xl"
            : "border-transparent bg-white"
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-500 ease-out-expo sm:px-6 lg:px-8 ${
            scrolled ? "py-2.5" : "py-3.5"
          }`}
        >
          <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="UPWA International Schools — home">
            <span className="relative shrink-0">
              <Image
                src="/upwa-logo.png"
                alt=""
                width={180}
                height={200}
                priority
                className={`object-contain transition-all duration-500 ease-out-expo ${
                  scrolled ? "h-11 w-10" : "h-14 w-[3.15rem]"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[1.05rem] font-bold leading-tight tracking-tight text-upwa-navy sm:text-[1.2rem]">
                {INSTITUTION_CONFIG.institutionalWebsiteName}
              </span>
              <span
                className={`mt-0.5 hidden truncate text-[10px] font-semibold uppercase tracking-brand text-slate-500 transition-opacity duration-300 sm:block ${
                  scrolled ? "opacity-0" : "opacity-100"
                }`}
              >
                International Group of Schools · Choba
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-upwa-canvas hover:text-upwa-blue-800 ${
                  link.wideOnly ? "hidden xl:block" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/portal"
              className="hidden items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-upwa-navy/35 hover:bg-upwa-canvas xl:inline-flex"
            >
              Explore the portal
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link href="/admissions" className="btn-primary hidden !px-5 !py-2.5 sm:inline-flex">
              Apply now
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-upwa-navy transition-colors hover:bg-upwa-canvas lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation — grid-rows transition so the panel can never clip its contents */}
        <div
          id="mobile-navigation"
          className={`grid border-slate-200 bg-white transition-all duration-500 ease-out-expo lg:hidden ${
            menuOpen
              ? "grid-rows-[1fr] border-t opacity-100"
              : "invisible grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
          <nav className="mx-auto max-w-7xl px-4 py-4 sm:px-6" aria-label="Mobile">
            <ul className="grid gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-upwa-navy transition-colors hover:bg-upwa-canvas"
                  >
                    {link.label}
                    <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <Link
                href="/admissions"
                onClick={() => setMenuOpen(false)}
                className="btn-primary w-full"
              >
                Apply now
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="btn-outline w-full"
              >
                Portal sign in
              </Link>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {UTILITY_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-upwa-canvas"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-upwa-canvas px-4 py-3 text-xs leading-5 text-slate-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-upwa-blue-700" aria-hidden="true" />
              {INSTITUTION_CONFIG.location}
            </p>
          </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
