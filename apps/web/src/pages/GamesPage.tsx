import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Game } from "../lib/api";
import { RowListSkeleton } from "../components/ui/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useDocumentMeta } from "../lib/useDocumentMeta";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const ChevronLeft = () => (
  <svg width="7" height="11" viewBox="0 0 7 11" fill="none" className="shrink-0">
    <path d="M6 1L1.5 5.5L6 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg width="7" height="11" viewBox="0 0 7 11" fill="none" className="shrink-0">
    <path d="M1 1L5.5 5.5L1 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Defaults to the current round — same definition as Home's next-game card
// and the Team Lists page (GET /games/current-round: the round of the next
// future kickoff, or the most recently played round once the season's
// fixtures are all done). Previous/next arrows step through every round
// that has at least one fixture (GET /games/rounds, chronological by that
// round's earliest kickoff — not sorted as text, so "Round 10" doesn't sort
// before "Round 9") for browsing back through past rounds.
export default function GamesPage() {
  const [rounds, setRounds] = useState<string[] | null>(null);
  const [round, setRound] = useState<string | null>(null);
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: round ? `${round} Fixtures` : "Fixtures",
    description: "NRL fixtures and results by round — kickoff times, venues, and full-time scores for every club.",
    path: "/games",
  });

  // Resolve the initial round once, from the same source as Home/Team Lists.
  useEffect(() => {
    Promise.all([api.getCurrentRoundLineups(), api.listRounds()])
      .then(([current, allRounds]) => {
        setRound(current.round);
        setRounds(allRounds);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Re-fetch whenever the selected round changes (including the first time
  // it's resolved above).
  useEffect(() => {
    if (!round) return;
    setGames(null);
    api.listGames(round).then(setGames).catch((err) => setError(err.message));
  }, [round]);

  const roundIndex = rounds && round ? rounds.indexOf(round) : -1;
  const hasPrev = roundIndex > 0;
  const hasNext = rounds !== null && roundIndex >= 0 && roundIndex < rounds.length - 1;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Games</h1>

      {rounds && round && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface border border-white/10 px-2 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && setRound(rounds[roundIndex - 1])}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            aria-label="Previous round"
          >
            <ChevronLeft />
          </button>
          <span className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider">{round}</span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && setRound(rounds[roundIndex + 1])}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            aria-label="Next round"
          >
            <ChevronRight />
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!games && !error && <RowListSkeleton count={5} />}
      {games && games.length === 0 && <p className="text-slate-500 text-sm">No games scheduled yet.</p>}
      <div>
        {games?.map((game) => (
          <Link
            key={game.id}
            to={`/games/${game.id}`}
            className="block border-b border-white/10 hover:bg-white/[0.03] transition-colors duration-150 active:scale-[0.99] py-5"
          >
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-bold text-brand-heliotrope uppercase tracking-wider">{game.round}</span>
              <span>{formatKickoff(game.kickoffAt)}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <TeamBadge team={game.homeTeam} size="sm" />
              <div className="font-display font-extrabold text-lg sm:text-xl text-white tracking-tight">
                {game.homeTeam.shortName}{" "}
                {game.status === "SCHEDULED" ? (
                  <span className="text-slate-500 font-normal">vs</span>
                ) : (
                  <span className="tabular-nums">
                    {game.homeScore}&ndash;{game.awayScore}
                  </span>
                )}{" "}
                {game.awayTeam.shortName}
              </div>
              <TeamBadge team={game.awayTeam} size="sm" />
              {game.status === "LIVE" && (
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-siren animate-pulse">
                  ● Live{game.liveClock ? ` ${game.liveClock}` : ""}
                </span>
              )}
            </div>
            {game.venue && <div className="text-xs text-slate-500 mt-0.5">{game.venue}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
