import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { api, Game } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { teamColors } from "../lib/teamBadge";

// One game in the strip, in the shape the cards draw.
interface StripGame {
  key: string;
  href: string;
  label: string; // "Round 1", "Grand Final"
  kickoff: number;
  status: "SCHEDULED" | "LIVE" | "FULL_TIME";
  clock: string | null;
  venue: string | null;
  sides: { name: string; score: number | null; color?: string }[];
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
      { name: g.homeTeam.shortName, score: g.homeScore, color: teamColors(g.homeTeam)[0] },
      { name: g.awayTeam.shortName, score: g.awayScore, color: teamColors(g.awayTeam)[0] },
    ],
  };
}

function statusText(g: StripGame): string {
  if (g.status === "LIVE") return g.clock ? `Live · ${g.clock}` : "Live";
  if (g.status === "FULL_TIME") return "Full time";
  const d = new Date(g.kickoff);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// Which game the strip starts on: one being played, else the latest result
// from the last few days, else the next one up.
function defaultIndex(games: StripGame[], now: number): number {
  const live = games.findIndex((g) => g.status === "LIVE");
  if (live >= 0) return live;
  const results = games.map((g, i) => ({ g, i })).filter(({ g }) => g.status === "FULL_TIME" && now - g.kickoff < 3 * DAY);
  if (results.length) return results[results.length - 1].i;
  const next = games.findIndex((g) => g.kickoff > now);
  return next >= 0 ? next : games.length - 1;
}

function GameCard({ g }: { g: StripGame }) {
  const live = g.status === "LIVE";
  const showScores = g.status !== "SCHEDULED";
  const leader =
    g.status === "FULL_TIME" && g.sides[0].score != null && g.sides[1].score != null && g.sides[0].score !== g.sides[1].score
      ? g.sides[0].score > g.sides[1].score
        ? 0
        : 1
      : -1;
  return (
    <Link
      to={g.href}
      data-game-card
      className="snap-start shrink-0 w-[152px] rounded-[14px] bg-surface border border-white/[.07] px-3 py-2.5 hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="font-display font-bold text-[10px] tracking-[.12em] uppercase text-brand-violet truncate">{g.label}</div>
      <div className={`mt-0.5 text-[10.5px] font-extrabold tracking-[.04em] uppercase truncate ${live ? "text-brand-siren" : "text-slate-400"}`}>
        {live && "● "}
        {statusText(g)}
      </div>
      <div className="mt-1.5 space-y-[3px]">
        {g.sides.map((s, k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-[4px] h-[15px] rounded-full shrink-0" style={{ background: s.color ?? "rgb(var(--c-surface-inset))" }} aria-hidden="true" />
            <span className={`flex-1 min-w-0 truncate text-[13.5px] font-bold ${leader === -1 || leader === k ? "text-white" : "text-slate-400"}`}>{s.name}</span>
            {showScores && (
              <span className={`font-display italic font-black text-[16px] tabular-nums ${leader === -1 || leader === k ? "text-white" : "text-slate-400"}`}>
                {s.score ?? 0}
              </span>
            )}
          </div>
        ))}
      </div>
      {g.venue && <div className="mt-1.5 text-[10.5px] text-slate-500 truncate">{g.venue}</div>}
    </Link>
  );
}

// The scoreboard at the top of Home: compact cards for every game around now
// in kickoff order, in a row you swipe (or
// step with the arrows on a computer). Opens scrolled to the live game, the
// latest result, or the next game. Tapping a card opens the game.
export default function ScoreStrip() {
  const [nrl, setNrl] = useState<Game[] | null>(null);
  const refreshTick = useRefreshTick();
  const [poll, setPoll] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);

  useEffect(() => {
    api.listGames().then(setNrl).catch(() => setNrl((p) => p ?? []));
  }, [refreshTick, poll]);

  const games = useMemo(() => {
    if (!nrl) return null;
    const now = Date.now();
    return nrl
      .map(fromNrl)
      .filter((g) => g.status === "LIVE" || (g.kickoff > now - RECENT_DAYS * DAY && g.kickoff < now + AHEAD_DAYS * DAY))
      .sort((a, b) => a.kickoff - b.kickoff);
  }, [nrl]);

  // First load only: scroll so the starting game is the first card in view.
  // Later refreshes leave the viewer's own scroll position alone.
  useEffect(() => {
    const row = rowRef.current;
    if (!games || games.length === 0 || !row || positioned.current) return;
    positioned.current = true;
    const card = row.querySelectorAll<HTMLElement>("[data-game-card]")[defaultIndex(games, Date.now())];
    if (card) row.scrollLeft = card.offsetLeft; // row is position:relative, so offsetLeft is within it
  }, [games]);

  // While a game is live, refresh the scores every minute.
  const anyLive = games?.some((g) => g.status === "LIVE") ?? false;
  useEffect(() => {
    if (!anyLive) return;
    const id = window.setInterval(() => setPoll((p) => p + 1), 60_000);
    return () => window.clearInterval(id);
  }, [anyLive]);

  if (!games || games.length === 0) return null;

  const step = (dir: -1 | 1) => {
    const row = rowRef.current;
    if (row) row.scrollBy({ left: dir * Math.max(160, row.clientWidth - 160), behavior: "smooth" });
  };
  const arrow = (dir: -1 | 1) => (
    <button
      type="button"
      aria-label={dir < 0 ? "Earlier games" : "Later games"}
      onClick={() => step(dir)}
      className="hidden lg:flex w-8 shrink-0 self-stretch rounded-xl items-center justify-center bg-white/[.05] border border-white/[.07] text-slate-300 hover:text-white"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );

  return (
    <section aria-label="Scores" className="flex items-stretch gap-2">
      {arrow(-1)}
      {/* Bleeds to the screen edge on phones so a part-shown card at the
          right says "swipe for more". */}
      <div ref={rowRef} className="relative flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-hide snap-x -mr-4 pr-4 lg:mr-0 lg:pr-0">
        {games.map((g) => (
          <GameCard key={g.key} g={g} />
        ))}
      </div>
      {arrow(1)}
    </section>
  );
}
