import type { Metadata } from "next";
import "./globals.css";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `${INSTITUTION_CONFIG.officialShortName} | ${INSTITUTION_CONFIG.institutionalWebsiteName}`,
  description: `${INSTITUTION_CONFIG.officialPlatformFullName} - ${INSTITUTION_CONFIG.tagline}`,
  icons: { icon: "/upwa-logo.png" },
  openGraph: {
    title: `${INSTITUTION_CONFIG.institutionalWebsiteName} | ${INSTITUTION_CONFIG.location}`,
    description: `${INSTITUTION_CONFIG.officialPlatformFullName} — ${INSTITUTION_CONFIG.tagline}`,
    siteName: INSTITUTION_CONFIG.institutionalWebsiteName,
    type: "website",
    locale: "en_NG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-upwa-canvas font-sans text-upwa-navy antialiased">
        {/* Scroll-reveal sections start hidden; make sure they are visible without JS. */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important;}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
