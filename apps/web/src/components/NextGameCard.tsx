import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, Game } from "../lib/api";
import { needsLivePolling, usePolling } from "../lib/liveGamePolling";
import { useRefreshTick } from "../lib/refresh";
import { teamAbbreviation, teamColors } from "../lib/teamBadge";
import TeamBadge from "./TeamBadge";

const LIVE_POLL_MS = 20_000;

// Just the time (e.g. "7:50 PM") — previously derived by splitting a
// combined weekday+time string on ", ", which silently rendered nothing
// whenever the resolved locale's toLocaleString format didn't happen to use
// a comma there (confirmed live: it did exactly that, leaving every card's
// top-right corner blank). Asking for only the time fields directly has no
// such assumption to break.
function formatKickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function TeamRow({ team, score, live }: { team: Game["homeTeam"]; score: number | null; live: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <div className="flex items-center gap-1.5 min-w-0">
        <TeamBadge team={team} size="sm" />
        <span className="text-[13px] font-extrabold text-white truncate">{teamAbbreviation(team)}</span>
      </div>
      {live && <span className="text-[13px] font-extrabold text-white tabular-nums shrink-0">{score}</span>}
    </div>
  );
}

// Compact, Bleacher-Report-style fixture card — small enough that several
// sit side by side in the swipeable row, no "Set reminder" affordance (that
// feature's been dropped entirely, not just hidden here — there was no
// real kickoff-push behind it anyway, see the old REMINDERS_KEY
// localStorage-only note this replaced).
function FixtureCard({ game, onOpen }: { game: Game; onOpen: () => void }) {
  const live = game.status === "LIVE";

  return (
    <div
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="snap-center shrink-0 w-[136px] cursor-pointer rounded-xl bg-surface border border-white/10 px-2.5 py-2 active:scale-[0.98] transition-transform duration-100"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-white/45 uppercase tracking-wide">
          {new Date(game.kickoffAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide ${live ? "text-brand-siren" : "text-white/45"}`}
        >
          {live ? `Live${game.liveClock ? ` ${game.liveClock}` : ""}` : formatKickoffTime(game.kickoffAt)}
        </span>
      </div>
      <TeamRow team={game.homeTeam} score={game.homeScore} live={live} />
      <TeamRow team={game.awayTeam} score={game.awayScore} live={live} />
      {(game.venue || game.weatherFlag) && (
        <div className="mt-1.5 pt-1.5 border-t border-white/[.06] flex items-center gap-1 min-w-0">
          {game.venue && <span className="text-[9.5px] font-semibold text-white/35 truncate">{game.venue}</span>}
          {game.weatherFlag && (
            <span
              title={game.weatherNote ?? "Weather-affected fixture"}
              className="shrink-0 text-[9.5px]"
              aria-label="Weather-affected fixture"
            >
              ☔
            </span>
          )}
        </div>
      )}
    </div>
  );
}


// "2d 06h" / "6h 12m" / "12m" until kickoff.
function countdownTo(iso: string, now: number): string {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function HeroTeam({ team, align }: { team: Game["homeTeam"]; align: "start" | "end" }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 min-w-0 lg:flex-row lg:gap-4 ${
        align === "end" ? "lg:flex-row-reverse lg:text-right" : ""
      }`}
    >
      <TeamBadge team={team} size="xl" />
      <span className="font-extrabold text-[15px] text-white truncate max-w-full lg:font-display lg:italic lg:font-black lg:text-[24px] lg:uppercase">
        {team.shortName}
      </span>
    </div>
  );
}

// The next game (or the live one) as one big full-width card — the biggest
// thing on Home, the way an app leads with its main event. A stripe in both
// clubs' colours across the top; a live countdown, or the score once it's on.
function HeroGameCard({ game }: { game: Game }) {
  const live = game.status === "LIVE";
  const now = useNow(30_000);
  const kickoff = new Date(game.kickoffAt);
  const when = `${kickoff.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${formatKickoffTime(game.kickoffAt)}`;
  const stripe = [...teamColors(game.homeTeam), ...teamColors(game.awayTeam)];

  return (
    <Link
      to={`/games/${game.id}`}
      className="block rounded-[22px] overflow-hidden border border-brand-violet/35 bg-surface hover:border-brand-violet/60 transition-colors duration-150"
    >
      <div className="flex h-1 lg:h-[5px]" aria-hidden="true">
        {stripe.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="px-[18px] pt-4 pb-[18px] lg:px-7 lg:pt-[22px] lg:pb-6 flex flex-col gap-4 lg:gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display italic font-black text-[13px] lg:text-[15px] tracking-[.14em] text-brand-violet uppercase">
            {game.round}
          </span>
          <span className={`text-[12.5px] lg:text-[14px] font-semibold ${live ? "text-brand-siren" : "text-slate-400"}`}>
            {live ? `Live${game.liveClock ? ` · ${game.liveClock}` : ""}` : when}
          </span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-center">
          <HeroTeam team={game.homeTeam} align="start" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display italic font-black text-[28px] lg:text-[40px] leading-none text-white tabular-nums">
              {live ? `${game.homeScore ?? 0}–${game.awayScore ?? 0}` : countdownTo(game.kickoffAt, now)}
            </span>
            <span className="text-[11px] lg:text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase">
              {live ? "Score" : "To kick-off"}
            </span>
          </div>
          <HeroTeam team={game.awayTeam} align="end" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[.07]">
          <span className="text-[12.5px] lg:text-[13.5px] text-slate-400 truncate">
            {game.venue}
            {game.weatherFlag && <span title={game.weatherNote ?? "Weather-affected fixture"}> · ☔</span>}
          </span>
          <span className="shrink-0 text-[12.5px] lg:text-[14px] font-bold text-brand-violet">Match centre →</span>
        </div>
      </div>
    </Link>
  );
}

// The next (or live) game as a big hero card, then the rest of the round's
// remaining fixtures as a horizontally swipeable carousel underneath (none
// in a one-game round like the Grand Final) — real data throughout: kickoff/venue from Game.
// Uses native CSS scroll-snap rather than a gesture library: touch swipe,
// trackpad, and mouse-wheel scrolling all just work, and a tap still fires
// the card's navigate-to-game click normally since nothing intercepts the
// gesture.
export default function NextGameCard() {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [allGames, setAllGames] = useState<Game[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const refreshTick = useRefreshTick();
  useEffect(() => {
    api.listGames().then(setAllGames).catch(() => setAllGames((prev) => prev ?? []));
  }, [refreshTick]);

  const allGamesRef = useRef(allGames);
  allGamesRef.current = allGames;

  // Keeps the carousel's scores/LIVE badges current — see liveGamePolling.ts.
  usePolling(() => {
    if (allGamesRef.current?.some(needsLivePolling)) {
      api.listGames().then(setAllGames).catch(() => {});
    }
  }, LIVE_POLL_MS);

  // A LIVE game keeps a past kickoffAt (see schema.prisma GameStatus design
  // note), so filtering by "kickoffAt > now" alone silently drops it off
  // this carousel the moment kickoff passes — fixed by keeping any LIVE
  // game regardless of its kickoff time, sorted ahead of merely-upcoming
  // ones so it's the first thing shown.
  function byLiveThenSoonest(a: Game, b: Game) {
    if ((a.status === "LIVE") !== (b.status === "LIVE")) return a.status === "LIVE" ? -1 : 1;
    return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
  }

  const fixtures = useMemo(() => {
    if (!allGames) return null;
    const now = Date.now();
    const isRelevant = (g: Game) => g.status === "LIVE" || new Date(g.kickoffAt).getTime() > now;
    const relevant = allGames.filter(isRelevant).sort(byLiveThenSoonest);
    if (relevant.length === 0) return [];
    const anchorRound = relevant[0].round;
    return allGames.filter((g) => g.round === anchorRound && isRelevant(g)).sort(byLiveThenSoonest);
  }, [allGames]);

  const rest = fixtures ? fixtures.slice(1) : [];

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || rest.length === 0) return;
    const cardWidth = el.scrollWidth / rest.length;
    setActiveIndex(Math.round(el.scrollLeft / cardWidth));
  }

  if (fixtures === null) return null; // still loading — no layout shift for a null result
  if (fixtures.length === 0) return null; // no upcoming fixtures this round

  return (
    <div className="space-y-3">
      <HeroGameCard game={fixtures[0]} />
      {rest.length > 0 && (
        <div>
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {rest.map((game) => (
              <FixtureCard key={game.id} game={game} onOpen={() => navigate(`/games/${game.id}`)} />
            ))}
          </div>
          {rest.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {rest.map((game, i) => (
                <span
                  key={game.id}
                  className={`h-1.5 rounded-full transition-all duration-150 ${
                    i === activeIndex ? "w-4 bg-brand-violet" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
