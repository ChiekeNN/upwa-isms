import type { Metadata, Viewport } from "next";
import "./globals.css";
import { INSTITUTION_CONFIG } from "@/config/institution";
import PwaInstall from "@/components/pwa-install";

export const metadata: Metadata = {
  title: `${INSTITUTION_CONFIG.officialShortName} | ${INSTITUTION_CONFIG.institutionalWebsiteName}`,
  description: `${INSTITUTION_CONFIG.officialPlatformFullName} - ${INSTITUTION_CONFIG.tagline}`,
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: INSTITUTION_CONFIG.officialShortName,
  },
  openGraph: {
    title: `${INSTITUTION_CONFIG.institutionalWebsiteName} | ${INSTITUTION_CONFIG.location}`,
    description: `${INSTITUTION_CONFIG.officialPlatformFullName} — ${INSTITUTION_CONFIG.tagline}`,
    siteName: INSTITUTION_CONFIG.institutionalWebsiteName,
    type: "website",
    locale: "en_NG",
  },
};

/** The browser chrome colour when installed, and on Android while loading. */
export const viewport: Viewport = {
  themeColor: "#0B2E46",
  width: "device-width",
  initialScale: 1,
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
        <PwaInstall />
      </body>
    </html>
  );
}
