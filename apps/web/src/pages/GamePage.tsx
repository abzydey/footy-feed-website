import { ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, GameDetail, Team, TryScorer } from "../lib/api";
import EventCard from "../components/EventCard";
import TeamListCard from "../components/TeamListCard";
import PageHero from "../components/ui/PageHero";
import SectionLabel from "../components/ui/SectionLabel";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta, useJsonLd } from "../lib/useDocumentMeta";

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

// Shared by both the FULL_TIME and LIVE heroes — same layout, just the
// eyebrow label/color and (FULL_TIME only) the try list beneath differ. See
// schema.prisma design note on GameStatus for why "finished" can no longer
// be inferred from the scores being non-null (a LIVE score is non-null
// too) — status is the source of truth now.
function ScoreHero({ game, eyebrow, eyebrowClass, children }: { game: GameDetail["game"]; eyebrow: string; eyebrowClass: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface border border-white/10 shadow-card p-5">
      <div className={`text-center text-[11px] font-bold uppercase tracking-wider mb-3 ${eyebrowClass}`}>{eyebrow}</div>
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
      {children}
    </div>
  );
}

// Final scoreline + try list — shown once the admin has logged the real
// result (see components/admin/GameForm.tsx ResultForm), replacing the
// upcoming-fixture hero. Team lists stay visible below either way, since
// they're historically accurate either way and were explicitly kept in
// scope. Highlight clips/player/team stats are deliberately out of scope.
function FinalScoreHero({ data }: { data: GameDetail }) {
  const { game, homeTries, awayTries } = data;
  return (
    <ScoreHero game={game} eyebrow="Full time" eyebrowClass="text-brand-heliotrope">
      <div className="flex gap-4 mt-5 pt-4 border-t border-white/10">
        <TryList team={game.homeTeam} tries={homeTries} />
        <TryList team={game.awayTeam} tries={awayTries} />
      </div>
    </ScoreHero>
  );
}

// Live in-play score — an admin's quick score update (POST
// .../live-score), not a full result: no try list yet, since that's only
// captured at full-time. Siren red/pulsing dot to read as "happening now",
// same visual language as the FINAL-stage team-list badge.
function LiveScoreHero({ data }: { data: GameDetail }) {
  const { liveClock } = data.game;
  return (
    <ScoreHero
      game={data.game}
      eyebrow={liveClock ? `● Live · ${liveClock}` : "● Live"}
      eyebrowClass="text-brand-siren animate-pulse"
    />
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
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {finished ? (
        <FinalScoreHero data={data} />
      ) : live ? (
        <LiveScoreHero data={data} />
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
