import { flagSrc } from "../lib/worldCup";

// A nation's flag, sized by className (4:3). Decorative — the name is always
// shown beside it. Renders a neutral box for a nation we have no flag for
// (and for knockout games before the teams are known).
export default function Flag({ abbr, className = "" }: { abbr: string; className?: string }) {
  const src = flagSrc(abbr);
  return src ? (
    <img src={src} alt="" className={`object-cover rounded-[3px] ring-1 ring-white/15 ${className}`} />
  ) : (
    <span className={`inline-block rounded-[3px] bg-surface-inset ring-1 ring-white/10 ${className}`} aria-hidden="true" />
  );
}
