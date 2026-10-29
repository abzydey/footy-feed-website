import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, FreeAgent } from "../lib/api";
import { byTier, FREE_AGENCY_ON_HOME_UNTIL, isDone, outcomeText, TALKS_OPEN_AT } from "../lib/freeAgents";
import { useRefreshTick } from "../lib/refresh";

// Home's window into the free agency tracker while the market is busy
// (until mid-December): how many top free agents have signed, the biggest
// names still out there, and the latest deals.
export default function FreeAgencyHomeCard() {
  const [players, setPlayers] = useState<FreeAgent[] | null>(null);
  const refreshTick = useRefreshTick();
  const showing = Date.now() < FREE_AGENCY_ON_HOME_UNTIL;

  useEffect(() => {
    if (!showing) return;
    api
      .listFreeAgents()
      .then((d) => setPlayers(d.players))
      .catch(() => setPlayers((prev) => prev ?? []));
  }, [refreshTick, showing]);

  if (!showing || !players || players.length === 0) return null;

  const top = players.filter((p) => p.tier);
  const topDone = top.filter(isDone).length;
  const biggest = top.filter((p) => !isDone(p)).sort(byTier).slice(0, 6);
  const latest = players
    .filter((p) => isDone(p) && p.decidedAt)
    .sort((a, b) => (b.decidedAt! > a.decidedAt! ? 1 : -1))
    .slice(0, 3);
  const days = Math.ceil((TALKS_OPEN_AT - Date.now()) / 86_400_000);

  return (
    <section className="bg-surface border border-white/[.07] rounded-[18px] px-4 pt-3.5 pb-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">Free agency · 2028</h2>
        <Link to="/free-agents" className="text-[12.5px] font-bold text-brand-violet hover:text-brand-hover">
          See all →
        </Link>
      </div>
      <Link to="/free-agents" className="block mt-1.5 hover:opacity-90">
        <div className="text-[15px] font-bold text-white">
          {topDone} of {top.length} top free agents signed
        </div>
        <div className="text-[12.5px] text-slate-500">
          {days > 1 ? `Talks with rival clubs open in ${days} days` : days === 1 ? "Talks with rival clubs open tomorrow" : "The market is open"}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/[.08] overflow-hidden">
          <div className="h-full bg-brand-violet rounded-full" style={{ width: `${top.length ? (topDone / top.length) * 100 : 0}%` }} />
        </div>
      </Link>
      {biggest.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">Biggest names available</div>
          <div className="flex flex-wrap gap-1.5">
            {biggest.map((p) => (
              <span key={p.id} className="rounded-full bg-white/[.05] border border-white/[.08] px-2.5 py-1 text-[12px] font-bold text-white">
                {p.player}
              </span>
            ))}
          </div>
        </div>
      )}
      {latest.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Latest deals</div>
          {latest.map((p) => (
            <div key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-bold text-slate-400 line-through decoration-brand-violet decoration-2 truncate">{p.player}</span>
              <span className="shrink-0 text-[12px] font-bold text-brand-violet">{outcomeText(p)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
