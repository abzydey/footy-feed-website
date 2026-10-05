import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, WorldCupMatch, WorldCupSquad } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { worldCupActive, worldCupNations } from "../lib/worldCup";
import Flag from "./Flag";

// Home's quick link into the World Cup squads — the same slim, glowing row
// the Team Lists card uses during the season: how many nations have named
// their squad, the flags of those that have, straight into Teams & squads.
// Only while the World Cup is on.
export default function WorldCupSquadsCard() {
  const [matches, setMatches] = useState<WorldCupMatch[] | null>(null);
  const [squads, setSquads] = useState<WorldCupSquad[] | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api.listWorldCupMatches().then(setMatches).catch(() => setMatches((prev) => prev ?? []));
    api.listWorldCupSquads().then(setSquads).catch(() => setSquads((prev) => prev ?? []));
  }, [refreshTick]);

  if (!matches || !squads || !worldCupActive(matches)) return null;
  const total = worldCupNations(matches).length;
  const named = squads.length;
  const allNamed = total > 0 && named >= total;

  return (
    <Link
      to="/world-cup/teams"
      className="flex items-center gap-3 rounded-[18px] px-4 py-3.5 bg-surface border border-brand-violet/30 shadow-[0_0_24px_-10px_theme(colors.brand.violet/60%)] hover:border-brand-violet/55 transition-colors duration-150"
    >
      <span className="min-w-0 flex-1 flex flex-col gap-[3px]">
        <span className="flex items-center gap-[7px]">
          {named > 0 && !allNamed && (
            <span className="relative flex h-[7px] w-[7px] shrink-0">
              <span className="absolute inset-0 rounded-full bg-brand-violet animate-ping opacity-75" />
              <span className="relative rounded-full h-[7px] w-[7px] bg-brand-violet" />
            </span>
          )}
          <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
            World Cup · {allNamed ? "All squads named" : `${named} of ${total} squads named`}
          </span>
        </span>
        <span className="font-extrabold text-[15.5px] leading-tight text-white">World Cup squads</span>
        {named > 0 ? (
          <span className="flex items-center gap-1.5 mt-1 flex-wrap">
            {squads.map((s) => (
              <Flag key={s.abbr} abbr={s.abbr} className="w-6 h-[18px]" />
            ))}
            <span className="text-[12.5px] text-slate-400 ml-0.5">
              {squads.length <= 2 ? squads.map((s) => s.name).join(" and ") : "and more"} named
            </span>
          </span>
        ) : (
          <span className="text-[12.5px] text-slate-400">No squads announced yet</span>
        )}
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
