import { useState } from "react";

import { getThemePref, setThemePref, ThemePref } from "../lib/theme";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "Match my phone" },
];

// Appearance switch — in the footer and the More sheet (both render
// FooterContent).
export default function ThemePicker() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);

  return (
    <div className="flex items-center gap-3">
      <span className="font-display font-extrabold text-[9.5px] tracking-[.24em] text-white/42 uppercase">Appearance</span>
      <div role="radiogroup" aria-label="Appearance" className="flex rounded-full border border-white/[.09] bg-surface p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={pref === o.value}
            onClick={() => {
              setThemePref(o.value);
              setPref(o.value);
            }}
            className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors duration-150 ${
              pref === o.value ? "bg-brand-violet/15 text-brand-violet" : "text-slate-400 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
