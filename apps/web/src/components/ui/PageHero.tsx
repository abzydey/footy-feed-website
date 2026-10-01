import { ReactNode } from "react";

interface PageHeroProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode; // e.g. a FollowButton, rendered alongside the title
}

/** Shared page header — small violet kicker, title, one-line subtitle and an
 * optional action. Same type scale as Home's cards: compact, app-style,
 * rather than a big banner that pushes the content down. */
export default function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <div className="pt-1 lg:pt-3">
      {eyebrow && (
        <div className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase mb-1">{eyebrow}</div>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display italic font-black text-[28px] lg:text-[34px] leading-tight tracking-tight text-white">{title}</h1>
        {children}
      </div>
      {subtitle && <p className="text-slate-400 text-[13.5px] mt-1">{subtitle}</p>}
    </div>
  );
}
