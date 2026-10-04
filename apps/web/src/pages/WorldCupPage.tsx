import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, EventItem, WorldCupMatch } from "../lib/api";
import { dedupeStories, readCachedFeed } from "../lib/feed";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { featuredMatch, flagFor, kickoffLabel, poolTable } from "../lib/worldCup";
import EventCard from "../components/EventCard";
import WorldCupMatchCard from "../components/WorldCupMatchCard";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";

const NEWS_PREVIEW = 6;

function PoolCard({ matches, pool }: { matches: WorldCupMatch[]; pool: "A" | "B" }) {
  const rows = poolTable(matches, pool);
  return (
    <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-2">
      <h3 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase mb-2">Pool {pool}</h3>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            <th className="text-left font-bold pb-1.5">Team</th>
            <th className="w-8 font-bold">P</th>
            <th className="w-8 font-bold">W</th>
            <th className="w-8 font-bold">L</th>
            <th className="w-10 font-bold">Diff</th>
            <th className="w-9 font-bold text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.abbr} className="border-t border-white/[.05]">
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span aria-hidden="true">{flagFor(r.abbr)}</span>
                  <span className="font-bold text-white truncate">{r.name}</span>
                </span>
              </td>
              <td className="text-center text-slate-300">{r.played}</td>
              <td className="text-center text-slate-300">{r.won}</td>
              <td className="text-center text-slate-300">{r.lost}</td>
              <td className="text-center text-slate-300">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
              <td className="text-right font-extrabold text-white">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MatchRow({ m }: { m: WorldCupMatch }) {
  const done = m.status === "FULL_TIME";
  const live = m.status === "LIVE";
  const side = (name: string, abbr: string, score: number | null, alignEnd: boolean) => (
    <span className={`flex items-center gap-2 min-w-0 ${alignEnd ? "flex-row-reverse text-right" : ""}`}>
      <span aria-hidden="true">{abbr === "TBA" ? "" : flagFor(abbr)}</span>
      <span className="font-bold text-[14px] text-white truncate">{abbr === "TBA" ? "TBA" : name}</span>
      {(done || live) && <span className="font-extrabold text-[14px] text-white tabular-nums">{score ?? 0}</span>}
    </span>
  );
  const inner = (
    <>
      <div className="flex items-center justify-between gap-3 text-[11.5px] font-semibold text-slate-500 mb-1">
        <span>{m.pool ? `Pool ${m.pool}` : m.roundName}</span>
        <span className={live ? "text-brand-siren" : ""}>{live ? "● Live" : done ? "Full time" : kickoffLabel(m.kickoffAt)}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-center">
        {side(m.homeName, m.homeAbbr, m.homeScore, false)}
        <span className="text-[12px] font-bold text-slate-600">v</span>
        {side(m.awayName, m.awayAbbr, m.awayScore, true)}
      </div>
      <div className="text-[11.5px] text-slate-500 mt-1 truncate">
        {m.venue}, {m.city}
      </div>
    </>
  );
  const cls = "block py-3 border-t border-white/[.05] first:border-t-0";
  return m.matchCentreUrl ? (
    <a href={m.matchCentreUrl} target="_blank" rel="noreferrer" className={`${cls} hover:opacity-80`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// Men's Rugby League World Cup hub: the next (or live) game, both pool
// tables, every fixture and result by round, and the World Cup news.
// Fixtures and results come from the official draw (synced by the API).
export default function WorldCupPage() {
  const [matches, setMatches] = useState<WorldCupMatch[] | null>(null);
  const [news, setNews] = useState<EventItem[] | null>(() => readCachedFeed());
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useDocumentMeta({
    title: "Rugby League World Cup 2026",
    description: "Men's Rugby League World Cup 2026 fixtures, results, pool tables and news.",
    path: "/world-cup",
  });

  useEffect(() => {
    api.listWorldCupMatches().then(setMatches).catch((err) => setError(err.message));
    api.getFeed().then(setNews).catch(() => {});
  }, [refreshTick]);

  const rounds = useMemo(() => {
    const byRound = new Map<string, WorldCupMatch[]>();
    for (const m of matches ?? []) byRound.set(m.roundName, [...(byRound.get(m.roundName) ?? []), m]);
    return [...byRound.entries()];
  }, [matches]);

  const featured = matches ? featuredMatch(matches) : null;
  const wcNews = news ? dedupeStories(news.filter((e) => e.worldCup && e.type === "GENERAL_NEWS")) : null;

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 lg:px-5 space-y-6">
      <PageHero eyebrow="Men's · 15 Oct – 15 Nov 2026" title="Rugby League World Cup" subtitle="Fixtures, results, pool tables and news." />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!matches && !error && <FeedSkeleton count={3} />}

      {featured && (
        <WorldCupMatchCard
          match={featured}
          footer={
            featured.matchCentreUrl ? (
              <a href={featured.matchCentreUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[12.5px] lg:text-[14px] font-bold text-brand-violet">
                Match centre →
              </a>
            ) : null
          }
        />
      )}

      {matches && matches.length > 0 && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0 lg:items-start">
          <div className="space-y-4">
            <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">Pools</h2>
            <PoolCard matches={matches} pool="A" />
            <PoolCard matches={matches} pool="B" />
          </div>
          <div className="space-y-4">
            <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">Fixtures &amp; results</h2>
            {rounds.map(([round, ms]) => (
              <section key={round} className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-1">
                <h3 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">{round}</h3>
                <div>
                  {ms.map((m) => (
                    <MatchRow key={m.id} m={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">World Cup news</h2>
          <Link to="/news?filter=world-cup" className="text-[13px] font-bold text-brand-violet hover:text-brand-hover">
            All World Cup news →
          </Link>
        </div>
        {!wcNews && <FeedSkeleton count={3} />}
        {wcNews && wcNews.length === 0 && <p className="text-slate-500 text-sm">No World Cup news yet.</p>}
        <div className="lg:grid lg:grid-cols-2 lg:gap-3">
          {wcNews?.slice(0, NEWS_PREVIEW).map((e) => (
            <div key={e.id} className="[&>article]:h-full lg:[&>article]:mb-0">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
