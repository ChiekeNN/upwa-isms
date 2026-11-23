import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        upwa: {
          navy: "#0B2E46",
          canvas: "#F3F9FC",
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
            600: "#26894D",
            700: "#1D713E",
            800: "#1B5B35",
            900: "#174B2D",
          },
          orange: {
            50: "#FFF7E8",
            100: "#FDEBC5",
            200: "#F9D58D",
            400: "#F6AE36",
            500: "#F39A1E",
            600: "#DE7E10",
            700: "#B85D0E",
            800: "#944914",
            900: "#783D15",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
