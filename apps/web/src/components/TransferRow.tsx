import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Transfer, TransferTeam } from "../lib/api";
import TeamBadge from "./TeamBadge";

const KIND_LABEL: Record<Transfer["kind"], string> = {
  SIGNED: "Signed",
  RE_SIGNED: "Re-signed",
  RELEASED: "Released",
  RETIRED: "Retired",
};

// Re-signings in violet, arrivals white, departures dimmed — wins/losses
// stay typographic per the brand rules, never red/green.
const KIND_CLASS: Record<Transfer["kind"], string> = {
  SIGNED: "text-white bg-white/[.08]",
  RE_SIGNED: "text-brand-violet bg-brand-violet/[.12]",
  RELEASED: "text-white/55 bg-white/[.05]",
  RETIRED: "text-white/55 bg-white/[.05]",
};

const name = (team: TransferTeam | null, label: string | null) => team?.shortName ?? label ?? null;

// "Storm → Cowboys", "Stays at Knights", "Raiders → St Helens".
function routeText(t: Transfer): string {
  const from = name(t.fromTeam, t.fromLabel);
  const to = name(t.toTeam, t.toLabel);
  if (t.kind === "RE_SIGNED") return `Stays at ${to ?? "club"}`;
  if (t.kind === "SIGNED") return from ? `${from} → ${to}` : `Joins ${to}`;
  if (t.kind === "RETIRED") return `Retires from ${from}`;
  return to ? `${from} → ${to}` : `Leaves ${from}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// One player move. The badge is the club the move is "for" (the new or
// staying club; the old club for a release/retirement). Tapping opens the
// story it came from: a Full Set article in-app, anything else on the
// outlet's site.
export default function TransferRow({ transfer: t, divider = true }: { transfer: Transfer; divider?: boolean }) {
  const badgeTeam = t.kind === "RELEASED" || t.kind === "RETIRED" ? t.fromTeam : t.toTeam;

  const content: ReactNode = (
    <>
      {badgeTeam ? (
        <TeamBadge team={badgeTeam} size="sm" />
      ) : (
        <span className="w-8 h-8 shrink-0 rounded-lg bg-surface-inset" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 flex flex-col gap-[1px]">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-[14px] text-white truncate">{t.player}</span>
          <span className={`shrink-0 rounded-full px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-wider ${KIND_CLASS[t.kind]}`}>
            {KIND_LABEL[t.kind]}
          </span>
        </span>
        <span className="text-[12.5px] text-slate-400 truncate">
          {routeText(t)}
          {t.contractUntil ? ` · until ${t.contractUntil}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">{shortDate(t.announcedAt)}</span>
    </>
  );

  const cls = `flex items-center gap-3 py-[11px] ${divider ? "border-t border-white/[.05]" : ""}`;
  const ev = t.event;
  if (ev?.isOriginalArticle && ev.slug) {
    return (
      <Link to={`/news/${ev.slug}`} className={`${cls} hover:opacity-80`}>
        {content}
      </Link>
    );
  }
  if (ev?.sourceUrl) {
    return (
      <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className={`${cls} hover:opacity-80`}>
        {content}
      </a>
    );
  }
  return <div className={cls}>{content}</div>;
}
