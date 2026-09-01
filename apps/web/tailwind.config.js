/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Full Set brand pack v1.0 — four colours only: navy, purple, white,
        // Siren. Purple is a single swappable token (accent) so a future
        // brand change stays a one-line edit. See handoff_fullset_brand/README.md.
        brand: {
          DEFAULT: "#8B4DFF",
          violet: "#8B4DFF", // Full Set Purple — buttons, links, section labels, kickers, top-8 rail
          heliotrope: "#A472FF", // accent/link — links and small purple type on navy (6.4:1 contrast)
          siren: "#FF6B2C", // the one warm accent — live now, kickoff imminent, late change, OUT. Never decorative.
        },
        // Card background, one step up from the page's app background so
        // cards visually lift off the page instead of blending into it.
        surface: {
          DEFAULT: "#0A1024", // fs-surface-700 — cards, panels
          alt: "#060B1E", // fs-surface-800 — alternating section band / ladder header row
          hover: "#141B33", // fs-surface-600 — raised/press state
          inset: "#1C2440", // fs-surface-500 — crest chips, avatars, inset fills
        },
        // Page background.
        app: "#04091B",
      },
      fontFamily: {
        display: ["Saira", "sans-serif"], // headings, kickers, numerals, jersey/ladder numerals — see brand pack Typography table. Italic is the default for display sizes.
        sans: ["Archivo", "system-ui", "sans-serif"], // body text default — replaces Tailwind's default stack
      },
      boxShadow: {
        // Brand rule: no drop shadows in dark mode — surfaces are separated
        // by fills and hairline borders only.
        card: "none",
      },
    },
  },
  plugins: [],
};
