import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, Game, WorldCupMatch } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { teamColors } from "../lib/teamBadge";
import { sideName } from "../lib/worldCup";
import Flag from "./Flag";

// One game in the strip, NRL or World Cup, in a common shape.
interface StripGame {
  key: string;
  href: string;
  label: string; // "Grand Final", "World Cup · Round 1"
  kickoff: number;
  status: "SCHEDULED" | "LIVE" | "FULL_TIME";
  clock: string | null;
  venue: string | null;
  sides: { name: string; score: number | null; mark: { color?: string; flag?: string } }[];
}

const DAY = 86_400_000;
const RECENT_DAYS = 14; // how far back results stay browsable
const AHEAD_DAYS = 21; // how far ahead fixtures are listed

function fromNrl(g: Game): StripGame {
  return {
    key: `nrl-${g.id}`,
    href: `/games/${g.id}`,
    label: g.round,
    kickoff: new Date(g.kickoffAt).getTime(),
    status: g.status,
    clock: g.liveClock,
    venue: g.venue,
    sides: [
      { name: g.homeTeam.shortName, score: g.homeScore, mark: { color: teamColors(g.homeTeam)[0] } },
      { name: g.awayTeam.shortName, score: g.awayScore, mark: { color: teamColors(g.awayTeam)[0] } },
    ],
  };
}

function fromWorldCup(m: WorldCupMatch): StripGame {
  return {
    key: `wc-${m.id}`,
    href: `/world-cup/${m.id}`,
    label: `World Cup · ${m.roundName}`,
    kickoff: new Date(m.kickoffAt).getTime(),
    status: m.status,
    clock: null,
    venue: m.venue,
    sides: [
      { name: sideName(m, "home"), score: m.homeScore, mark: { flag: m.homeAbbr } },
      { name: sideName(m, "away"), score: m.awayScore, mark: { flag: m.awayAbbr } },
    ],
  };
}

function statusText(g: StripGame): string {
  if (g.status === "LIVE") return g.clock ? `Live · ${g.clock}` : "Live";
  if (g.status === "FULL_TIME") return "Full time";
  const d = new Date(g.kickoff);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Which game to open on: one being played, else the latest result from the
// last few days, else the next one up.
function defaultIndex(games: StripGame[], now: number): number {
  const live = games.findIndex((g) => g.status === "LIVE");
  if (live >= 0) return live;
  const results = games.map((g, i) => ({ g, i })).filter(({ g }) => g.status === "FULL_TIME" && now - g.kickoff < 3 * DAY);
  if (results.length) return results[results.length - 1].i;
  const next = games.findIndex((g) => g.kickoff > now);
  return next >= 0 ? next : games.length - 1;
}

// A slim scoreboard at the top of Home: one game at a time, NRL and World
// Cup together in kickoff order, with arrows to step back through recent
// results and forward through upcoming games. Tapping it opens the game.
export default function ScoreStrip() {
  const [nrl, setNrl] = useState<Game[] | null>(null);
  const [wc, setWc] = useState<WorldCupMatch[] | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const refreshTick = useRefreshTick();
  const [poll, setPoll] = useState(0);

  useEffect(() => {
    api.listGames().then(setNrl).catch(() => setNrl((p) => p ?? []));
    api.listWorldCupMatches().then(setWc).catch(() => setWc((p) => p ?? []));
  }, [refreshTick, poll]);

  const games = useMemo(() => {
    if (!nrl || !wc) return null;
    const now = Date.now();
    return [...nrl.map(fromNrl), ...wc.map(fromWorldCup)]
      .filter((g) => g.status === "LIVE" || (g.kickoff > now - RECENT_DAYS * DAY && g.kickoff < now + AHEAD_DAYS * DAY))
      .sort((a, b) => a.kickoff - b.kickoff);
  }, [nrl, wc]);

  // While a game is live, refresh the scores every minute.
  const anyLive = games?.some((g) => g.status === "LIVE") ?? false;
  useEffect(() => {
    if (!anyLive) return;
    const id = window.setInterval(() => setPoll((p) => p + 1), 60_000);
    return () => window.clearInterval(id);
  }, [anyLive]);

  if (!games || games.length === 0) return null;
  const i = Math.min(index ?? defaultIndex(games, Date.now()), games.length - 1);
  const g = games[i];
  const live = g.status === "LIVE";
  const showScores = g.status !== "SCHEDULED";
  const leader =
    g.status === "FULL_TIME" && g.sides[0].score != null && g.sides[1].score != null && g.sides[0].score !== g.sides[1].score
      ? g.sides[0].score > g.sides[1].score
        ? 0
        : 1
      : -1;

  const arrow = (dir: -1 | 1) => {
    const target = i + dir;
    const disabled = target < 0 || target >= games.length;
    return (
      <button
        type="button"
        aria-label={dir < 0 ? "Previous game" : "Next game"}
        disabled={disabled}
        onClick={() => setIndex(target)}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[.05] border border-white/[.07] text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
        </svg>
      </button>
    );
  };

  return (
    <section aria-label="Scores" className="flex items-center gap-3">
      <Link
        to={g.href}
        className="flex-1 min-w-0 rounded-[14px] bg-surface border border-white/[.07] px-3.5 py-2.5 hover:border-brand-violet/45 transition-colors duration-150"
      >
        <div className={`flex items-center justify-between gap-2 ${g.venue ? "" : "mb-1.5"}`}>
          <span className="font-display font-bold text-[10.5px] tracking-[.14em] uppercase text-brand-violet truncate">{g.label}</span>
          <span className={`shrink-0 text-[10.5px] font-extrabold tracking-[.08em] uppercase ${live ? "text-brand-siren" : "text-slate-400"}`}>
            {live && "● "}
            {statusText(g)}
          </span>
        </div>
        {g.venue && <div className="mb-1.5 text-[11.5px] text-slate-500 truncate">{g.venue}</div>}
        {g.sides.map((s, k) => (
          <div key={k} className="flex items-center gap-2.5 py-[2px]">
            {s.mark.flag ? (
              <Flag abbr={s.mark.flag} className="w-[18px] h-[13px] shrink-0" />
            ) : (
              <span className="w-[4px] h-[16px] rounded-full shrink-0" style={{ background: s.mark.color ?? "#1C2440" }} aria-hidden="true" />
            )}
            <span className={`flex-1 min-w-0 truncate text-[14px] font-bold ${leader === -1 || leader === k ? "text-white" : "text-slate-400"}`}>{s.name}</span>
            {showScores && (
              <span className={`font-display italic font-black text-[17px] tabular-nums ${leader === -1 || leader === k ? "text-white" : "text-slate-400"}`}>
                {s.score ?? 0}
              </span>
            )}
          </div>
        ))}
      </Link>
      <div className="flex flex-col gap-1.5">
        {arrow(-1)}
        {arrow(1)}
      </div>
    </section>
  );
}
