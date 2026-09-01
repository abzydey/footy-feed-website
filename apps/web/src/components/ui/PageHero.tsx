import { ReactNode } from "react";

interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  accentColor?: string;
  children?: ReactNode; // e.g. a FollowButton, rendered alongside the title
}

/** Shared hero header for Team/Game/General-News pages — accent bar, eyebrow, title, subtitle, and an action slot. */
export default function PageHero({ eyebrow, title, subtitle, accentColor, children }: PageHeroProps) {
  return (
    <div className="space-y-2">
      <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: accentColor ?? "#8B4DFF" }} />
      {eyebrow && <div className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider">{eyebrow}</div>}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display italic font-black text-3xl sm:text-4xl tracking-tight text-white">{title}</h1>
        {children}
      </div>
      {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
    </div>
  );
}
