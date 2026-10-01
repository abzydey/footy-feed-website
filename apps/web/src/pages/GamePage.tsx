import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, GameDetail, Team, TryScorer } from "../lib/api";
import EventCard from "../components/EventCard";
import TeamListCard from "../components/TeamListCard";
import MatchHero from "../components/MatchHero";
import SectionLabel from "../components/ui/SectionLabel";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta, useJsonLd } from "../lib/useDocumentMeta";
import { needsLivePolling, usePolling } from "../lib/liveGamePolling";

const LIVE_POLL_MS = 20_000;

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

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!id) return;
    setData(null);
    api.getGame(id).then(setData).catch((err) => setError(err.message));
  }, [id]);

  // Refreshes score/clock/try-list while this game is live (or about to be)
  // — without this, a viewer sitting on the page never sees the score move,
  // even though the API's own liveScorePoller is updating it every 2.5min.
  usePolling(() => {
    if (id && needsLivePolling(dataRef.current?.game)) {
      api.getGame(id).then(setData).catch(() => {});
    }
  }, LIVE_POLL_MS);

  const metaGame = data?.game;
  const metaFinished = metaGame?.status === "FULL_TIME";
  const matchup = metaGame ? `${metaGame.homeTeam.shortName} vs ${metaGame.awayTeam.shortName}` : "Game";

  useDocumentMeta({
    title: metaGame ? `${matchup} — ${metaGame.round}` : "Game",
    description: metaGame
      ? metaFinished
        ? `Full time: ${metaGame.homeTeam.shortName} ${metaGame.homeScore}-${metaGame.awayScore} ${metaGame.awayTeam.shortName}. Try scorers, team lists, and match news on Full Set.`
        : `${matchup} — ${metaGame.round}. Kickoff, venue, team lists, and build-up on Full Set.`
      : "NRL match details on Full Set.",
    path: id ? `/games/${id}` : undefined,
  });

  // SportsEvent structured data for search engines — homeTeam/awayTeam as
  // SportsTeam, eventStatus reflecting whether the game has been played, and
  // (when finished) a simple text score in description since schema.org has
  // no first-class "final score" property for SportsEvent.
  useJsonLd(
    metaGame
      ? {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          name: matchup,
          startDate: metaGame.kickoffAt,
          eventStatus: metaFinished
            ? "https://schema.org/EventCompleted"
            : "https://schema.org/EventScheduled",
          location: metaGame.venue ? { "@type": "Place", name: metaGame.venue } : undefined,
          homeTeam: { "@type": "SportsTeam", name: metaGame.homeTeam.name },
          awayTeam: { "@type": "SportsTeam", name: metaGame.awayTeam.name },
          url: `https://fullset.au/games/${id}`,
        }
      : null
  );

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
  const finished = game.status === "FULL_TIME";
  const live = game.status === "LIVE";

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 lg:px-5 lg:pt-7 space-y-6">
      <MatchHero game={game}>
        {(live || finished) && (data.homeTries.length > 0 || data.awayTries.length > 0) && (
          <div className="flex gap-4 pt-4 border-t border-white/[.07]">
            <TryList team={game.homeTeam} tries={data.homeTries} />
            <TryList team={game.awayTeam} tries={data.awayTries} />
          </div>
        )}
      </MatchHero>

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
