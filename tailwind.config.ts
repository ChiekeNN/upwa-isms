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
          navy: "#0F172A",
          emerald: "#059669",
          gold: "#D97706",
        },
      },
    },
  },
  plugins: [],
};

export default config;
