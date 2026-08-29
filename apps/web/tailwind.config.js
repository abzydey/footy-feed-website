/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette, per the design handoff (docs: design
        // handoff README, "Design Tokens"). accent/violet is explicitly a
        // single swappable token — alternates given there are #7C5CFF
        // (default) / #2E6BFF / #9B4DFF / #5B6BFF. Swapping this one value
        // re-themes every button/link/badge/rail in the app.
        brand: {
          DEFAULT: "#7C5CFF",
          violet: "#7C5CFF", // primary: buttons, links, section labels, kickers, top-8 rail
          heliotrope: "#A99AFF", // lighter tint: hover accents, secondary links
          blue: "#2E6BFF", // secondary accent: game-card gradient border, kickoff times
        },
        // Card background, one step up from the page's app background so
        // cards visually lift off the page instead of blending into it.
        surface: {
          DEFAULT: "#13131B",
          alt: "#101018", // ladder column-header row
          hover: "#1b1d24",
        },
        // Page background — not pure black, per the design handoff.
        app: "#0C0C12",
        // Status semantics used across team-list/injury badges, ladder diff,
        // form chips. Bar/dot variants are the more saturated companion used
        // for small fills (progress bars, dots) vs. the text/border tone.
        positive: { DEFAULT: "#3FE08C", bar: "#2ED67C" },
        warning: { DEFAULT: "#FFB13F" },
        negative: { DEFAULT: "#FF5C82", bar: "#FF3B6B" },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "sans-serif"], // headings, kickers, numerals — see handoff Typography table
        sans: ["Archivo", "system-ui", "sans-serif"], // body text default — replaces Tailwind's default stack
      },
      boxShadow: {
        // Soft, brand-tinted elevation for surface cards instead of a
        // generic gray shadow.
        card: "0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(105,39,244,0.25)",
      },
    },
  },
  plugins: [],
};
