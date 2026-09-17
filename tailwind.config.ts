import type { Config } from "tailwindcss";

// Material Design 3 color roles, but tuned toward a Linear/Vercel-style
// "monochrome + one carbon accent" look: near-black (#18181B) as primary
// instead of Google blue, cool neutral grays, white surfaces, sharper
// (near-rectangular) corners.
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
          DEFAULT: "#18181B",
          container: "#F4F4F5",
        },
        "on-primary": "#FFFFFF",
        "on-primary-container": "#18181B",
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
        sans: ["var(--font-inter)", "Inter", "system-ui", "Arial", "sans-serif"],
      },
      // Near-rectangular corners (Linear/Vercel-style) instead of the
      // rounder M3 defaults — every existing rounded-lg/rounded-xl usage
      // in the app picks this up automatically.
      borderRadius: {
        lg: "0.25rem", // 4px (was 8px)
        xl: "0.375rem", // 6px (was 12px)
      },
      // Compact, Ahrefs/Excel-style density: smaller than the previous
      // "bumped for screen-sharing" scale, but still a notch above raw
      // Tailwind defaults for legibility.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.1rem" }], // 12px
        sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13px
        base: ["0.9375rem", { lineHeight: "1.4rem" }], // 15px
        lg: ["1.0625rem", { lineHeight: "1.5rem" }], // 17px
        xl: ["1.125rem", { lineHeight: "1.6rem" }], // 18px
        "2xl": ["1.375rem", { lineHeight: "1.85rem" }], // 22px
      },
      spacing: {
        4.5: "1.125rem",
        7.5: "1.875rem",
      },
      maxWidth: {
        "8xl": "96rem", // 1536px — used for the main dashboard so it can
        // actually use wide desktop screens instead of stopping at ~1150px.
      },
    },
  },
  plugins: [],
};
export default config;
