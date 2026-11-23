import type { Metadata } from "next";
import "./globals.css";
import { INSTITUTION_CONFIG } from "@/config/institution";

export const metadata: Metadata = {
  title: `${INSTITUTION_CONFIG.officialShortName} | ${INSTITUTION_CONFIG.institutionalWebsiteName}`,
  description: `${INSTITUTION_CONFIG.officialPlatformFullName} - ${INSTITUTION_CONFIG.tagline}`,
  icons: { icon: "/upwa-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-upwa-canvas text-upwa-navy antialiased">
        {children}
      </body>
    </html>
  );
}
