/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6927F4",
          violet: "#6927F4",
          heliotrope: "#AE87FF",
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
