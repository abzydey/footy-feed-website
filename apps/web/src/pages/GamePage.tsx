import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, GameDetail, Team, TryScorer } from "../lib/api";
import EventCard from "../components/EventCard";
import TeamListCard from "../components/TeamListCard";
import PageHero from "../components/ui/PageHero";
import SectionLabel from "../components/ui/SectionLabel";
import { FeedSkeleton } from "../components/ui/Skeleton";

function TryList({ team, tries }: { team: Team; tries: TryScorer[] }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{team.shortName}</div>
      {tries.length === 0 ? (
        <p className="text-slate-600 text-xs">No tries logged.</p>
      ) : (
        <ul className="space-y-1">
          {tries.map((t) => (
            <li key={t.id} className="text-sm text-slate-300 flex gap-1.5">
              <span className="truncate">{t.scorer}</span>
              <span className="shrink-0 text-slate-500">{t.minute}'</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Final scoreline + try list — shown once the admin has logged a result (see
// components/admin/GameForm.tsx ResultForm), replacing the upcoming-fixture
// hero. homeScore/awayScore both non-null is the only signal for "finished"
// (see routes/adminGames.ts POST /:id/result design note); team lists stay
// visible below either way, since they're historically accurate either way
// and were explicitly kept in scope. Highlight clips/player/team stats are
// deliberately out of scope for this pass.
function FinalScoreHero({ data }: { data: GameDetail }) {
  const { game, homeTries, awayTries } = data;
  return (
    <div className="rounded-2xl bg-surface border border-white/10 shadow-card p-5">
      <div className="text-center text-[11px] font-bold uppercase tracking-wider text-brand-heliotrope mb-3">
        Full time
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-center min-w-0">
          <Link
            to={`/teams/${game.homeTeam.slug}`}
            className="font-display font-bold text-lg text-white hover:text-brand-heliotrope transition-colors duration-150 truncate block"
          >
            {game.homeTeam.shortName}
          </Link>
        </div>
        <div className="font-display font-extrabold text-3xl text-white tabular-nums whitespace-nowrap">
          {game.homeScore}&ndash;{game.awayScore}
        </div>
        <div className="text-center min-w-0">
          <Link
            to={`/teams/${game.awayTeam.slug}`}
            className="font-display font-bold text-lg text-white hover:text-brand-heliotrope transition-colors duration-150 truncate block"
          >
            {game.awayTeam.shortName}
          </Link>
        </div>
      </div>

      <div className="flex gap-4 mt-5 pt-4 border-t border-white/10">
        <TryList team={game.homeTeam} tries={homeTries} />
        <TryList team={game.awayTeam} tries={awayTries} />
      </div>
    </div>
  );
}

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setData(null);
    api.getGame(id).then(setData).catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="p-4 text-red-400 text-sm">{error}</p>;

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="space-y-2">
          <div className="h-1.5 w-16 bg-white/10 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-64 bg-white/10 rounded animate-pulse" />
        </div>
        <FeedSkeleton count={3} />
      </div>
    );
  }

  const { game, homeTeamLineup, awayTeamLineup, recentEvents, socialPosts } = data;
  const finished = game.homeScore != null && game.awayScore != null;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {finished ? (
        <FinalScoreHero data={data} />
      ) : (
        <PageHero
          eyebrow={game.round}
          subtitle={game.venue ? `${formatKickoff(game.kickoffAt)} · ${game.venue}` : formatKickoff(game.kickoffAt)}
          title={
            <>
              <Link to={`/teams/${game.homeTeam.slug}`} className="hover:text-brand-heliotrope transition-colors duration-150">
                {game.homeTeam.shortName}
              </Link>{" "}
              <span className="text-slate-500">vs</span>{" "}
              <Link to={`/teams/${game.awayTeam.slug}`} className="hover:text-brand-heliotrope transition-colors duration-150">
                {game.awayTeam.shortName}
              </Link>
            </>
          }
        />
      )}

      <section>
        <SectionLabel>Team lists</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TeamListCard team={game.homeTeam} stages={homeTeamLineup} kickoffAt={game.kickoffAt} />
          <TeamListCard team={game.awayTeam} stages={awayTeamLineup} kickoffAt={game.kickoffAt} />
        </div>
      </section>

      <section>
        <SectionLabel>Late changes &amp; news</SectionLabel>
        <div>
          {recentEvents.length === 0 && <p className="text-slate-500 text-sm">No updates yet for this match.</p>}
          {recentEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {socialPosts.length > 0 && (
        <section>
          <SectionLabel>Social</SectionLabel>
          <div>
            {socialPosts.map((post) => (
              <EventCard key={post.id} event={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
