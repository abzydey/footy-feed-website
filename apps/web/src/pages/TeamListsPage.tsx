import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, RoundLineups } from "../lib/api";
import TeamListCard from "../components/TeamListCard";
import PageHero from "../components/ui/PageHero";
import SectionLabel from "../components/ui/SectionLabel";
import { FeedSkeleton } from "../components/ui/Skeleton";
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

// Every game in the current round, all in one scrollable page — same
// per-team INITIAL/24HR/FINAL stage tracker as an individual game page (see
// GamePage.tsx), just for the whole round at once instead of one match at a
// time. "Current round" is whatever GET /games/current-round resolves to
// (see routes/games.ts) — the round of the next kickoff, or the most
// recently played one once the season's done.
export default function TeamListsPage() {
  const [data, setData] = useState<RoundLineups | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "Team Lists",
    description: "Official NRL team lists for the current round — Initial, 24hr, and Final, as they're released.",
    path: "/team-lists",
  });

  useEffect(() => {
    api.getCurrentRoundLineups().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="p-4 text-red-400 text-sm">{error}</p>;

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-64 bg-white/10 rounded animate-pulse" />
        </div>
        <FeedSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <PageHero eyebrow={data.round ?? undefined} title="Team lists" subtitle="Every matchup's team list, all in one place." />

      {data.games.length === 0 && <p className="text-slate-500 text-sm">No fixtures found.</p>}

      {data.games.map(({ game, homeTeamLineup, awayTeamLineup }) => (
        <section key={game.id}>
          <SectionLabel>
            <Link to={`/games/${game.id}`} className="hover:text-white transition-colors duration-150">
              {game.homeTeam.shortName} vs {game.awayTeam.shortName}
            </Link>
          </SectionLabel>
          <p className="text-[11.5px] font-semibold text-white/42 -mt-2 mb-2.5">
            {formatKickoff(game.kickoffAt)}
            {game.venue && ` · ${game.venue}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TeamListCard team={game.homeTeam} stages={homeTeamLineup} kickoffAt={game.kickoffAt} />
            <TeamListCard team={game.awayTeam} stages={awayTeamLineup} kickoffAt={game.kickoffAt} />
          </div>
        </section>
      ))}
    </div>
  );
}
