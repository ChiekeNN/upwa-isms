import type { MetadataRoute } from "next";
import { INSTITUTION_CONFIG } from "@/config/institution";

/**
 * The install manifest. Next serves it at /manifest.webmanifest and links it
 * from every page, which is what lets Chrome, Edge and Android offer
 * "Install app", and what iOS and Android read for the home-screen icon,
 * splash colour and standalone window.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: INSTITUTION_CONFIG.officialPlatformFullName,
    short_name: INSTITUTION_CONFIG.officialShortName,
    description: `${INSTITUTION_CONFIG.officialPlatformFullName} — ${INSTITUTION_CONFIG.tagline}`,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#061B29",
    theme_color: "#0B2E46",
    lang: "en",
    dir: "ltr",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "President's Office",
        short_name: "President",
        description: "The President's oversight dashboard and control register",
        url: "/portal",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Admissions",
        short_name: "Admissions",
        description: "Apply to Division A or Division B",
        url: "/admissions",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };
}
