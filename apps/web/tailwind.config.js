/** @type {import('tailwindcss').Config} */
// Every neutral (white, slate, surface, app) and the brand purple read CSS
// variables set per theme in index.css, so the same class names work in
// both the dark (default) and light themes — see lib/theme.ts.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  // Hover styles only on devices that can hover — on phones a tapped row
  // otherwise keeps its hover colour after you come back to the page.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        // "white" is the foreground colour: real white in dark mode, navy in
        // light mode. Solid purple/orange fills reset it to real white (see
        // index.css), so button text stays white in both.
        white: v("fg"),
        slate: {
          100: v("slate-100"),
          200: v("slate-200"),
          300: v("slate-300"),
          400: v("slate-400"),
          500: v("slate-500"),
          600: v("slate-600"),
          700: v("slate-700"),
          800: v("slate-800"),
        },
        // Full Set brand pack v1.0 — four colours only: navy, purple, white,
        // Siren. Purple is a single swappable token (accent) so a future
        // brand change stays a one-line edit. See handoff_fullset_brand/README.md.
        brand: {
          DEFAULT: v("violet"),
          violet: v("violet"), // Full Set Purple — buttons, links, section labels, kickers, top-8 rail
          // Was #A472FF (a deliberately lighter shade for small purple text's
          // contrast on navy — 6.4:1 vs violet's own ~4.3:1, borderline for
          // WCAG AA at small sizes). Set equal to violet on request ("I want
          // my brand colouring to be violet") so every brand-heliotrope use
          // across the app (~21 files: kickers, section labels, links)
          // renders as the exact same purple with a one-line change here,
          // rather than hunting down each usage — small violet text on navy
          // is a real, if minor, contrast regression from before.
          heliotrope: v("violet"),
          hover: v("violet-hover"), // lighter tone shown on hover for solid brand-coloured buttons/fills and accent-on-hover text/links — deliberately distinct from violet, not an opacity trick
          siren: "#FF6B2C", // the one warm accent — live now, kickoff imminent, late change, OUT. Never decorative.
        },
        // Card background, one step up from the page's app background so
        // cards visually lift off the page instead of blending into it.
        // Lifted from near-black (#04091B page / #0A1024 cards) to a true
        // navy in Oct 2026 — the old pair were so close the page read as
        // one black slab ("our page is a bit too dark").
        surface: {
          DEFAULT: v("surface"), // fs-surface-700 — cards, panels (dark #142048)
          alt: v("surface-alt"), // fs-surface-800 — alternating section band / ladder header row (dark #0F1A3D)
          hover: v("surface-hover"), // fs-surface-600 — raised/press state (dark #1C2A58)
          inset: v("surface-inset"), // fs-surface-500 — crest chips, avatars, inset fills (dark #25346A)
        },
        // Page background.
        app: v("app"), // dark #0B1533
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
