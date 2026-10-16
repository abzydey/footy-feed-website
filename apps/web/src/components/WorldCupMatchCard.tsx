import { ReactNode } from "react";

import { WorldCupMatch } from "../lib/api";
import { kickoffLabel, poolLabel, sideName } from "../lib/worldCup";
import Flag from "./Flag";

function Side({ name, abbr }: { name: string; abbr: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <Flag abbr={abbr} className="w-[60px] h-[45px] lg:w-[76px] lg:h-[57px]" />
      <span className="font-extrabold text-[15px] lg:text-[17px] leading-tight text-white text-center">{name}</span>
    </div>
  );
}

// Try scorers for one side, in the order scored (from NRL.com's match centre).
function TryList({ name, tries, align }: { name: string; tries: { scorer: string; minute: number }[]; align: "left" | "right" }) {
  const sorted = [...tries].sort((a, b) => a.minute - b.minute);
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 truncate">{name}</div>
      {sorted.length === 0 ? (
        <p className="text-slate-500 text-xs">No tries</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((t, i) => (
            <li key={i} className={`text-sm text-slate-300 flex gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
              <span className="min-w-0 [overflow-wrap:anywhere]">{t.scorer}</span>
              <span className="shrink-0 text-slate-500 tabular-nums">{t.minute}'</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The big World Cup match card — same shell as the club MatchHero, flags in
// place of club badges. Tapping it opens the official match centre.
export default function WorldCupMatchCard({ match: m, kicker, footer }: { match: WorldCupMatch; kicker?: ReactNode; footer?: ReactNode }) {
  const live = m.status === "LIVE";
  const done = m.status === "FULL_TIME";
  const label = `${m.roundName}${m.pool ? ` · ${poolLabel(m.pool)}` : ""}`;

  const body = (
    <div className="px-[18px] pt-4 pb-[18px] lg:px-7 lg:pt-[22px] lg:pb-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display italic font-black text-[13px] lg:text-[15px] tracking-[.14em] text-brand-violet uppercase">
          {kicker ?? label}
        </span>
        <span className={`text-[12.5px] lg:text-[14px] font-semibold ${live ? "text-brand-siren" : "text-slate-400"}`}>
          {live ? `● Live${m.liveClock ? ` · ${m.liveClock}` : ""}` : done ? "Full time" : kickoffLabel(m.kickoffAt)}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-start">
        <Side name={sideName(m, "home")} abbr={m.homeAbbr} />
        <div className="flex flex-col items-center gap-0.5 self-center">
          <span className="font-display italic font-black text-[28px] lg:text-[40px] leading-none text-white tabular-nums whitespace-nowrap">
            {live || done ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}` : "v"}
          </span>
          {kicker && <span className="text-[11px] font-bold tracking-[.12em] text-slate-400 uppercase">{label}</span>}
        </div>
        <Side name={sideName(m, "away")} abbr={m.awayAbbr} />
      </div>
      {(live || done) && m.tries && m.tries.length > 0 && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/[.07]">
          {(["HOME", "AWAY"] as const).map((side) => (
            <TryList key={side} name={sideName(m, side === "HOME" ? "home" : "away")} tries={m.tries!.filter((t) => t.side === side)} align={side === "HOME" ? "left" : "right"} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[.07]">
        <span className="text-[12.5px] lg:text-[13.5px] text-slate-400 truncate">
          {m.venue}, {m.city}
        </span>
        {footer}
      </div>
    </div>
  );

  return <div className="rounded-[22px] overflow-hidden border border-brand-violet/35 bg-surface">{body}</div>;
}
