import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, WorldCupMatch, WorldCupSquad } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { kickoffLabel, poolLabel, worldCupNations } from "../lib/worldCup";
import Flag from "../components/Flag";
import { FeedSkeleton } from "../components/ui/Skeleton";

// One nation: its announced squad (captain and debutants marked as the
// announcement did, shadow players listed separately) and its games.
export default function WorldCupNationPage() {
  const { abbr = "" } = useParams<{ abbr: string }>();
  const [matches, setMatches] = useState<WorldCupMatch[] | null>(null);
  const [squad, setSquad] = useState<WorldCupSquad | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api.listWorldCupMatches().then(setMatches).catch((err) => setError(err.message));
    api
      .listWorldCupSquads()
      .then((all) => setSquad(all.find((s) => s.abbr === abbr.toUpperCase()) ?? null))
      .catch(() => setSquad((prev) => prev ?? null));
  }, [abbr, refreshTick]);

  const nation = matches ? worldCupNations(matches).find((n) => n.abbr === abbr.toUpperCase()) : undefined;
  const games = (matches ?? []).filter((m) => m.homeAbbr === nation?.abbr || m.awayAbbr === nation?.abbr);

  useDocumentMeta({
    title: nation ? `${nation.name} — World Cup squad` : "World Cup squad",
    description: nation ? `${nation.name}'s men's Rugby League World Cup 2026 squad and fixtures.` : "World Cup squad",
    path: `/world-cup/teams/${abbr}`,
  });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <Link to="/world-cup/teams" className="inline-block text-[13px] font-bold text-brand-violet hover:text-brand-hover">
        ← All teams
      </Link>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {(!matches || squad === undefined) && !error && <FeedSkeleton count={3} />}
      {matches && !nation && <p className="text-slate-500 text-sm">That nation isn't in the men's World Cup.</p>}

      {nation && squad !== undefined && (
        <>
          <div className="flex items-center gap-4">
            <Flag abbr={nation.abbr} className="w-16 h-12 shrink-0" />
            <div>
              <div className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
                Rugby League World Cup · {poolLabel(nation.pool)}
              </div>
              <h1 className="font-display italic font-black text-[30px] leading-tight text-white">{nation.name}</h1>
            </div>
          </div>

          <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">Squad</h2>
              {squad && <span className="text-[12px] font-bold text-slate-500">{squad.players.length}</span>}
            </div>
            {!squad ? (
              <p className="text-[13px] text-slate-500 py-3">Not announced yet — it'll appear here once it is.</p>
            ) : (
              <>
                {squad.note && <p className="text-[12.5px] font-semibold text-slate-300 pb-2">{squad.note}</p>}
                <ul className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
                  {squad.players.map((p) => (
                    <li key={p.name} className="flex items-center gap-2 py-2 border-t border-white/[.05] text-[14px]">
                      <span className="font-bold text-white">{p.name}</span>
                      {p.club && <span className="text-[12px] text-slate-400 truncate">{p.club}</span>}
                      {p.captain && <span className="text-[11px] font-extrabold text-brand-violet">(c)</span>}
                      {p.debutant && (
                        <span className="rounded-full px-2 py-[1px] text-[10px] font-extrabold uppercase tracking-wider text-brand-violet bg-brand-violet/[.12]">
                          Debut
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {squad.shadows && squad.shadows.length > 0 && (
                  <p className="text-[12.5px] text-slate-400 pt-3 pb-1 border-t border-white/[.05] mt-1">
                    <span className="font-bold text-slate-300">Shadow players:</span> {squad.shadows.join(", ")}
                  </p>
                )}
                {squad.players.some((p) => p.debutant) && (
                  <p className="text-[11.5px] text-slate-500 pb-1">Debut = would be their first Test for {nation.name}.</p>
                )}
              </>
            )}
          </section>

          <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-1">
            <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase mb-1">Games</h2>
            {games.map((m) => {
              const home = m.homeAbbr === nation.abbr;
              const oppName = home ? m.awayName : m.homeName;
              const oppAbbr = home ? m.awayAbbr : m.homeAbbr;
              const done = m.status === "FULL_TIME" && m.homeScore != null && m.awayScore != null;
              const us = home ? m.homeScore : m.awayScore;
              const them = home ? m.awayScore : m.homeScore;
              return (
                <Link key={m.id} to={`/world-cup/${m.id}`} className="flex items-center gap-3 py-3 border-t border-white/[.05] first:border-t-0 hover:opacity-80">
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="flex items-center gap-2 font-bold text-[14px] text-white">
                      v {oppAbbr !== "TBA" && <Flag abbr={oppAbbr} className="w-5 h-[15px]" />}
                      {oppAbbr === "TBA" ? "TBA" : oppName}
                    </span>
                    <span className="text-[11.5px] text-slate-500 truncate">
                      {m.roundName} · {m.venue}, {m.city}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-slate-400 tabular-nums">
                    {done ? `${us}–${them}` : m.status === "LIVE" ? "● Live" : kickoffLabel(m.kickoffAt)}
                  </span>
                </Link>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
