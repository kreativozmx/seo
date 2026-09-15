import type { Config } from "tailwindcss";

// Material Design 3 color roles, tuned to match Google Search Console's
// look: Google blue (#1a73e8) as primary, cool neutral grays (Google's
// own gray scale) instead of a warm palette, white surfaces.
// https://m3.material.io/styles/color/roles
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        // M3 color roles
        primary: {
          DEFAULT: "#1A73E8",
          container: "#D3E3FD",
        },
        "on-primary": "#FFFFFF",
        "on-primary-container": "#041E49",
        secondary: {
          DEFAULT: "#5F6368",
          container: "#E8EAED",
        },
        "on-secondary-container": "#202124",
        tertiary: {
          DEFAULT: "#188038",
          container: "#CEEAD6",
        },
        "on-tertiary-container": "#0D652D",
        surface: {
          DEFAULT: "#FFFFFF",
          dim: "#E8EAED",
          bright: "#FFFFFF",
          lowest: "#FFFFFF",
          low: "#F8F9FA",
          container: "#F1F3F4",
          high: "#E8EAED",
          highest: "#DADCE0",
        },
        "on-surface": "#202124",
        "on-surface-variant": "#5F6368",
        outline: {
          DEFAULT: "#80868B",
          variant: "#DADCE0",
        },

        // Google's own cool gray scale (replaces Tailwind's default
        // neutral) so every existing neutral-* utility already reads as
        // an authentic Search Console surface tone.
        neutral: {
          50: "#F8F9FA",
          100: "#F1F3F4",
          200: "#E8EAED",
          300: "#DADCE0",
          400: "#BDC1C6",
          500: "#9AA0A6",
          600: "#80868B",
          700: "#5F6368",
          800: "#3C4043",
          900: "#202124",
        },
      },
      boxShadow: {
        "elevation-1": "0 1px 2px 0 rgba(60,64,67,0.30), 0 1px 3px 1px rgba(60,64,67,0.15)",
        "elevation-2": "0 1px 2px 0 rgba(60,64,67,0.30), 0 2px 6px 2px rgba(60,64,67,0.15)",
        "elevation-3": "0 1px 3px 0 rgba(60,64,67,0.30), 0 4px 8px 3px rgba(60,64,67,0.15)",
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "Roboto", "Arial", "system-ui", "sans-serif"],
      },
      // Bumped ~1-2px across the board vs Tailwind's defaults so the app
      // stays legible when screen-sharing in calls (most of the UI runs on
      // text-xs/text-sm). Overriding the scale here covers every existing
      // text-xs/sm/base/etc usage without touching each className.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.2rem" }], // 13px (was 12px)
        sm: ["0.9375rem", { lineHeight: "1.4rem" }], // 15px (was 14px)
        base: ["1.0625rem", { lineHeight: "1.6rem" }], // 17px (was 16px)
        lg: ["1.1875rem", { lineHeight: "1.75rem" }], // 19px (was 18px)
        xl: ["1.3125rem", { lineHeight: "1.75rem" }], // 21px (was 20px)
        "2xl": ["1.5625rem", { lineHeight: "2rem" }], // 25px (was 24px)
      },
    },
  },
  plugins: [],
};
export default config;
