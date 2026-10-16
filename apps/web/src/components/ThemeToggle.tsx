import { useEffect, useState } from "react";

import { getThemePref, setThemePref } from "../lib/theme";

const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

// The sun/moon button in the top bar: one tap switches between dark and
// light. Shows a sun in dark mode (tap for light) and a moon in light mode.
// "Match my phone" stays in the Appearance switch (More sheet, footer).
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">(currentTheme);

  // Follow changes made elsewhere (the Appearance switch, or the phone
  // switching while on "Match my phone").
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(currentTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        setThemePref(next);
        setTheme(next);
      }}
      aria-label={next === "light" ? "Switch to light mode" : "Switch to dark mode"}
      title={getThemePref() === "system" ? "Following your phone — tap to choose" : undefined}
      className={`flex items-center justify-center text-slate-300 hover:text-white ${className}`}
    >
      {theme === "dark" ? (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        </svg>
      )}
    </button>
  );
}
