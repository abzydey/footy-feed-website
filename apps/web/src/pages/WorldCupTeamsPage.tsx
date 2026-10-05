import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, WorldCupMatch, WorldCupSquad } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { worldCupNations } from "../lib/worldCup";
import Flag from "../components/Flag";
import WorldCupTabs from "../components/WorldCupTabs";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";

// Every men's World Cup nation, by pool, and whether its squad is out yet.
export default function WorldCupTeamsPage() {
  const [matches, setMatches] = useState<WorldCupMatch[] | null>(null);
  const [squads, setSquads] = useState<WorldCupSquad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useDocumentMeta({
    title: "World Cup teams & squads",
    description: "Every men's Rugby League World Cup 2026 nation and its announced squad.",
    path: "/world-cup/teams",
  });

  useEffect(() => {
    api.listWorldCupMatches().then(setMatches).catch((err) => setError(err.message));
    api.listWorldCupSquads().then(setSquads).catch(() => setSquads((prev) => prev ?? []));
  }, [refreshTick]);

  const nations = useMemo(() => (matches ? worldCupNations(matches) : []), [matches]);
  const squadFor = (abbr: string) => squads?.find((s) => s.abbr === abbr);

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 lg:px-5 space-y-5">
      <PageHero eyebrow="Rugby League World Cup 2026" title="Teams & squads" subtitle="All ten nations. Squads appear here as they're announced." />
      <WorldCupTabs />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!matches && !error && <FeedSkeleton count={4} />}

      {(["A", "B"] as const).map((pool) => {
        const list = nations.filter((n) => n.pool === pool);
        if (list.length === 0) return null;
        return (
          <section key={pool}>
            <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase mb-2">Pool {pool}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((n) => {
                const squad = squadFor(n.abbr);
                return (
                  <Link
                    key={n.abbr}
                    to={`/world-cup/teams/${n.abbr}`}
                    className="flex items-center gap-3 rounded-[18px] bg-surface border border-white/[.07] px-4 py-3.5 hover:border-brand-violet/45 transition-colors duration-150"
                  >
                    <Flag abbr={n.abbr} className="w-10 h-[30px] shrink-0" />
                    <span className="min-w-0 flex-1 flex flex-col">
                      <span className="font-extrabold text-[15px] text-white truncate">{n.name}</span>
                      <span className={`text-[12px] ${squad ? "text-brand-violet font-bold" : "text-slate-500"}`}>
                        {squad ? `Squad named · ${squad.players.length} players` : "Squad not announced yet"}
                      </span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
