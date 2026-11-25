import type { Config } from "tailwindcss";

/**
 * Design tokens for the UPWA International Schools public website.
 *
 * Type is delivered through carefully ordered system font stacks rather than a
 * hosted webfont: the institutional serif keeps headings fast to first paint
 * (no blocking font request) while still reading as a prestige school brand.
 */
const displayStack = [
  '"Iowan Old Style"',
  '"Palatino Linotype"',
  "Palatino",
  '"Book Antiqua"',
  '"URW Palladio L"',
  '"Hoefler Text"',
  "Georgia",
  "ui-serif",
  "serif",
];

const sansStack = [
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  '"Noto Sans"',
  "sans-serif",
];

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: sansStack,
        display: displayStack,
      },
      colors: {
        upwa: {
          navy: "#0B2E46",
          midnight: "#061B29",
          canvas: "#F3F9FC",
          ivory: "#FBFAF6",
          blue: {
            50: "#EFFAFF",
            100: "#DDF4FC",
            200: "#BCE8F7",
            300: "#8AD6EF",
            400: "#4CBDE0",
            500: "#1CA4D1",
            600: "#0789B8",
            700: "#087098",
            800: "#0B5B79",
            900: "#0D4B64",
            950: "#07344A",
          },
          green: {
            50: "#EFF9F2",
            100: "#D8F0DF",
            200: "#B6E2C3",
            300: "#8FD3A6",
            600: "#26894D",
            700: "#1D713E",
            800: "#1B5B35",
            900: "#174B2D",
            950: "#0F3821",
          },
          orange: {
            50: "#FFF7E8",
            100: "#FDEBC5",
            200: "#F9D58D",
            300: "#F8C46A",
            400: "#F6AE36",
            500: "#F39A1E",
            600: "#DE7E10",
            700: "#B85D0E",
            800: "#944914",
            900: "#783D15",
          },
        },
      },
      letterSpacing: {
        brand: "0.18em",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      boxShadow: {
        "panel": "0 1px 2px rgba(11,46,70,0.04), 0 12px 32px -12px rgba(11,46,70,0.16)",
        "panel-lg": "0 2px 4px rgba(11,46,70,0.05), 0 28px 60px -24px rgba(11,46,70,0.32)",
        "lift": "0 18px 40px -18px rgba(11,46,70,0.35)",
        "inset-hair": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translate3d(0,18px,0)" },
          "100%": { opacity: "1", transform: "translate3d(0,0,0)" },
        },
        "drift": {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-14px,0) scale(1.03)" },
        },
        "pulse-ring": {
          "0%": { opacity: "0.5", transform: "scale(0.96)" },
          "70%,100%": { opacity: "0", transform: "scale(1.25)" },
        },
      },
      animation: {
        "fade-up": "fade-up 700ms cubic-bezier(0.16,1,0.3,1) both",
        "drift": "drift 14s ease-in-out infinite",
        "pulse-ring": "pulse-ring 3.2s cubic-bezier(0.16,1,0.3,1) infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};

export default config;
