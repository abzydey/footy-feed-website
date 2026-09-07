import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, Game } from "../lib/api";
import { teamAbbreviation } from "../lib/teamBadge";
import TeamBadge from "./TeamBadge";

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

// A horizontally swipeable carousel of the round's remaining fixtures,
// starting at the next one — real data throughout: kickoff/venue from Game.
// Uses native CSS scroll-snap rather than a gesture library: touch swipe,
// trackpad, and mouse-wheel scrolling all just work, and a tap still fires
// the card's navigate-to-game click normally since nothing intercepts the
// gesture.
export default function NextGameCard() {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [allGames, setAllGames] = useState<Game[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    api.listGames().then(setAllGames).catch(() => setAllGames([]));
  }, []);

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

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || !fixtures || fixtures.length === 0) return;
    const cardWidth = el.scrollWidth / fixtures.length;
    setActiveIndex(Math.round(el.scrollLeft / cardWidth));
  }

  if (fixtures === null) return null; // still loading — no layout shift for a null result
  if (fixtures.length === 0) return null; // no upcoming fixtures this round

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {fixtures.map((game) => (
          <FixtureCard key={game.id} game={game} onOpen={() => navigate(`/games/${game.id}`)} />
        ))}
      </div>
      {fixtures.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {fixtures.map((game, i) => (
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
  );
}
