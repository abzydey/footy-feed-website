import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Game } from "../lib/api";
import { RowListSkeleton } from "../components/ui/Skeleton";

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listGames().then(setGames).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white">Games</h1>
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
            <div className="font-display font-extrabold text-lg sm:text-xl text-white tracking-tight">
              {game.homeTeam.shortName} <span className="text-slate-500 font-normal">vs</span>{" "}
              {game.awayTeam.shortName}
            </div>
            {game.venue && <div className="text-xs text-slate-500 mt-0.5">{game.venue}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
