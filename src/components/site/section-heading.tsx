import type { ReactNode } from "react";

type Tone = "light" | "dark";

type SectionHeadingProps = {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  tone?: Tone;
  align?: "left" | "center";
  action?: ReactNode;
  className?: string;
};

/**
 * Shared editorial heading used across the public website so every section
 * shares one rhythm: ornament rule, tracked eyebrow, display-serif title, lede.
 */
export default function SectionHeading({
  eyebrow,
  title,
  lede,
  tone = "light",
  align = "left",
  action,
  className = "",
}: SectionHeadingProps) {
  const dark = tone === "dark";
  const centered = align === "center";

  return (
    <div
      className={`flex flex-col gap-6 ${
        centered ? "items-center text-center" : "md:flex-row md:items-end md:justify-between"
      } ${className}`}
    >
      <div className={centered ? "max-w-3xl" : "max-w-2xl"}>
        <span className={`ornament-rule block w-14 ${centered ? "mx-auto" : ""}`} aria-hidden="true" />
        <p className={`eyebrow mt-4 ${dark ? "text-upwa-orange-400" : "text-upwa-blue-700"}`}>{eyebrow}</p>
        <h2
          className={`mt-3 font-display text-3xl leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem] ${
            dark ? "text-white" : "text-upwa-navy"
          }`}
        >
          {title}
        </h2>
        {lede ? (
          <p className={`mt-4 text-base leading-7 sm:text-lg ${dark ? "text-slate-300" : "text-slate-600"}`}>{lede}</p>
        ) : null}
      </div>
      {action && !centered ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
