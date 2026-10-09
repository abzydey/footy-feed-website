// Light/dark theme. The viewer picks Dark (the default, the brand's own
// look), Light, or "Match my phone"; the choice lives in localStorage on
// that device. index.html runs the same logic inline before first paint so
// the page never flashes the wrong theme — keep the two in step.
//
// How it works: every white/grey/navy in the app is a CSS variable (see
// index.css and tailwind.config.js), so Tailwind's text-white,
// border-white/10, bg-surface, text-slate-400 etc. all flip with
// <html data-theme>, without each component knowing about themes.

export type ThemePref = "dark" | "light" | "system";

const KEY = "fs-theme";
const lightQuery = () => window.matchMedia("(prefers-color-scheme: light)");

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "system" || v === "dark") return v;
  } catch {
    // Storage blocked (private mode etc.) — fall through to the default.
  }
  return "dark";
}

function apply(pref: ThemePref) {
  const theme = pref === "system" ? (lightQuery().matches ? "light" : "dark") : pref;
  document.documentElement.dataset.theme = theme;
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Not saved, but still applied for this visit.
  }
  apply(pref);
}

// While on "Match my phone", follow the phone switching (e.g. automatic
// dark mode at sunset) without a reload.
export function watchSystemTheme() {
  lightQuery().addEventListener("change", () => {
    if (getThemePref() === "system") apply("system");
  });
}
