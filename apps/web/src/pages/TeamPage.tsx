import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, EventItem, Game, LadderRow, Player, Team, TeamListStages } from "../lib/api";
import { ordinal } from "../lib/format";
import EventCard from "../components/EventCard";
import FollowButton from "../components/FollowButton";
import TeamListCard from "../components/TeamListCard";
import { FeedSkeleton } from "../components/ui/Skeleton";

// Brand rule: no green/amber/red status colours — Siren (the one warm
// accent) is reserved for things that matter right now, which "OUT" for an
// upcoming match genuinely is. A pending "questionable" call isn't, so it
// stays neutral/typographic like everything else.
const INJURY_COLOR: Record<string, string> = {
  QUESTIONABLE: "text-white/50",
  OUT: "text-brand-siren",
  INJURED: "text-brand-siren",
  SUSPENDED: "text-brand-siren",
};

const TEAM_TABS = ["Overview", "Fixtures", "Stats"] as const;
type TeamTab = (typeof TEAM_TABS)[number];

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One row of a team's own fixture list — opponent, home/away, date, venue, and the score once finished. */
function FixtureRow({ team, game }: { team: Team; game: Game }) {
  const isHome = game.homeTeam.id === team.id;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  const finished = game.homeScore != null && game.awayScore != null;
  const ownScore = finished ? (isHome ? game.homeScore : game.awayScore) : null;
  const oppScore = finished ? (isHome ? game.awayScore : game.homeScore) : null;

  return (
    <Link
      to={`/games/${game.id}`}
      className="block border-b border-white/10 hover:bg-white/[0.03] transition-colors duration-150 active:scale-[0.99] py-4"
    >
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span className="font-bold text-brand-heliotrope uppercase tracking-wider">{game.round}</span>
        <span>{formatKickoff(game.kickoffAt)}</span>
      </div>
      <div className="font-display font-extrabold text-lg text-white tracking-tight">
        {isHome ? "vs" : "@"} {opponent.shortName}
        {finished && (
          <span className="ml-2 text-slate-300 font-semibold text-base">
            {ownScore}–{oppScore}
          </span>
        )}
      </div>
      {game.venue && <div className="text-xs text-slate-500 mt-0.5">{game.venue}</div>}
    </Link>
  );
}

export default function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    team: Team;
    players: Player[];
    currentGame: Game | null;
    lineupStages: TeamListStages | null;
    lastGame: Game | null;
    nextFixture: Game | null;
    recentEvents: EventItem[];
    socialPosts: EventItem[];
  } | null>(null);
  const [ladderRow, setLadderRow] = useState<LadderRow | null>(null);
  const [allGames, setAllGames] = useState<Game[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<TeamTab>("Overview");

  useEffect(() => {
    if (!slug) return;
    setData(null);
    api.getTeamBrief(slug).then(setData).catch((err) => setError(err.message));
  }, [slug]);

  // Whole-season game list for the Fixtures tab — same data source as the
  // Games page/admin, just filtered client-side to this team rather than a
  // dedicated per-team endpoint (the full list is already small enough).
  useEffect(() => {
    api.listGames().then(setAllGames).catch(() => setAllGames([]));
  }, []);

  useEffect(() => {
    if (!data) return;
    api
      .getLadder()
      .then((ladder) => setLadderRow(ladder.rows.find((r) => r.team.id === data.team.id) ?? null))
      .catch(() => setLadderRow(null));
  }, [data]);

  if (error) return <p className="p-4 text-red-400 text-sm">{error}</p>;

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="h-40 bg-surface rounded-2xl animate-pulse" />
        <FeedSkeleton count={2} />
      </div>
    );
  }

  const { team, players, currentGame, lineupStages, lastGame, nextFixture, recentEvents, socialPosts } = data;

  // "Brisbane Broncos" -> "Brisbane" / "Broncos" — name always ends with
  // shortName in the seeded data, so this derives the design's two-line
  // team name split without a separate field.
  const line1 = team.name.endsWith(team.shortName)
    ? team.name.slice(0, team.name.length - team.shortName.length).trim()
    : "";

  const injured = players.filter((p) => p.currentStatus !== "AVAILABLE" && p.currentStatus !== "UNKNOWN");
  const form = ladderRow?.form ? ladderRow.form.split("") : [];
  const opponent = currentGame && (currentGame.homeTeam.id === team.id ? currentGame.awayTeam : currentGame.homeTeam);

  // The round has moved on (currentGame — whichever game this team's latest
  // LINEUP_CHANGE belongs to — is finished) but this team's next INITIAL
  // list hasn't landed yet, so the card below is showing real but historical
  // data. Only true once a next fixture actually exists — see routes/teams.ts.
  const isStaleTeamList = currentGame?.homeScore != null && nextFixture != null;
  const nextOpponent = nextFixture && (nextFixture.homeTeam.id === team.id ? nextFixture.awayTeam : nextFixture.homeTeam);

  const teamGames = (allGames ?? []).filter((g) => g.homeTeam.id === team.id || g.awayTeam.id === team.id);
  const upcomingGames = teamGames
    .filter((g) => g.homeScore == null)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  const pastGames = teamGames
    .filter((g) => g.homeScore != null)
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  const lastResult = (() => {
    if (!lastGame || lastGame.homeScore == null || lastGame.awayScore == null) return null;
    const isHome = lastGame.homeTeam.id === team.id;
    const ownScore = isHome ? lastGame.homeScore : lastGame.awayScore;
    const oppScore = isHome ? lastGame.awayScore : lastGame.homeScore;
    const lastOpponent = isHome ? lastGame.awayTeam : lastGame.homeTeam;
    const letter = ownScore > oppScore ? "W" : ownScore < oppScore ? "L" : "D";
    return { gameId: lastGame.id, letter, ownScore, oppScore, opponentShortName: lastOpponent.shortName };
  })();
  // Brand rule: wins/losses are typographic, never colour-coded.
  const LAST_RESULT_COLOR: Record<string, string> = { W: "text-white", L: "text-white/60", D: "text-white/60" };

  return (
    <div>
      <div className="bg-[linear-gradient(165deg,#241A52_0%,#141B33_45%,#04091B_100%)] px-5 pt-[50px] pb-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between mb-4">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-white/70 hover:text-white transition-colors duration-150">
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
              <path d="M8 1L1 8l7 7M1 8h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <FollowButton targetType="TEAM" targetId={team.id} label="FOLLOW" followingLabel="FOLLOWING" />
        </div>

        <div className="max-w-3xl mx-auto flex items-center gap-3.5">
          <div className="shrink-0 w-[62px] h-[62px] rounded-2xl bg-white/[.08] border border-white/[.14] flex flex-col items-center justify-center gap-0.5">
            <span className="font-display font-bold text-xl tracking-[.04em] text-white">
              {team.shortName.slice(0, 3).toUpperCase()}
            </span>
            <span className="font-mono text-[6px] tracking-[.06em] text-white/40">CREST</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display italic font-black text-[32px] leading-[.95] tracking-[.01em] text-white uppercase">
              {line1 && (
                <>
                  {line1}
                  <br />
                </>
              )}
              {team.shortName}
            </h1>
            {ladderRow && (
              <div className="flex items-center gap-2 text-xs font-bold text-white/50 mt-1.5">
                <span>{ordinal(ladderRow.rank)}</span>
                <span className="w-[3px] h-[3px] rounded-full bg-white/22" />
                <span>
                  {ladderRow.wins}W-{ladderRow.losses}L
                </span>
                <span className="w-[3px] h-[3px] rounded-full bg-white/22" />
                <span>{ladderRow.pointsDifferential > 0 ? `+${ladderRow.pointsDifferential}` : ladderRow.pointsDifferential}</span>
              </div>
            )}
            {lastResult && (
              <Link
                to={`/games/${lastResult.gameId}`}
                className="block text-xs font-semibold text-white/50 hover:text-white mt-1 transition-colors duration-150"
              >
                Last:{" "}
                <span className={`font-bold ${LAST_RESULT_COLOR[lastResult.letter]}`}>
                  {lastResult.letter} {lastResult.ownScore}-{lastResult.oppScore}
                </span>{" "}
                vs {lastResult.opponentShortName}
              </Link>
            )}
          </div>
        </div>

        {form.length > 0 && (
          <div className="max-w-3xl mx-auto flex items-center gap-2.5 mt-[18px]">
            <span className="font-display font-bold text-[11px] tracking-[.14em] text-white/42">FORM</span>
            <div className="flex gap-1.5">
              {form.map((r, i) => (
                <span
                  key={i}
                  // Brand rule: wins/losses are typographic, never coloured —
                  // W is the brighter chip, L the dimmer one, distinguished
                  // by the letter itself.
                  className={`w-[22px] h-[22px] rounded-md flex items-center justify-center font-display font-bold text-xs border ${
                    r === "W"
                      ? "bg-white/10 border-white/[.26] text-white"
                      : r === "L"
                        ? "bg-transparent border-white/[.12] text-white/42"
                        : "bg-white/10 border-white/20 text-white"
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
            <span className="ml-auto text-[11.5px] font-semibold text-white/42">last {form.length}</span>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto flex gap-2 px-4 py-3 border-b border-white/[.07]">
        {TEAM_TABS.map((t) => {
          const active = teamTab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTeamTab(t)}
              className={`flex-1 text-[12.5px] font-bold rounded-[10px] py-2.5 border transition-colors duration-150 ${
                active ? "bg-white/10 text-white border-transparent" : "bg-transparent text-white/50 border-white/10"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {teamTab === "Stats" && (
          <p className="text-[13.5px] font-semibold text-white/50 text-center mt-10">Stats — coming soon.</p>
        )}

        {teamTab === "Fixtures" && (
          <>
            {!allGames && <FeedSkeleton count={4} />}
            {allGames && teamGames.length === 0 && (
              <p className="text-slate-500 text-sm">No fixtures scheduled yet.</p>
            )}
            {upcomingGames.length > 0 && (
              <>
                <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase mb-2.5">
                  Upcoming
                </h2>
                <div>
                  {upcomingGames.map((game) => (
                    <FixtureRow key={game.id} team={team} game={game} />
                  ))}
                </div>
              </>
            )}
            {pastGames.length > 0 && (
              <>
                <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase mt-[26px] mb-2.5">
                  Past results
                </h2>
                <div>
                  {pastGames.map((game) => (
                    <FixtureRow key={game.id} team={team} game={game} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {teamTab === "Overview" && (
          <>
            {isStaleTeamList && nextFixture && nextOpponent && (
              <div className="rounded-lg border border-dashed border-white/15 px-3.5 py-3 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Last team list — {nextFixture.round} team list not yet released
                </p>
                <Link
                  to={`/games/${nextFixture.id}`}
                  className="block text-[12.5px] font-semibold text-white/70 hover:text-white mt-1.5 transition-colors duration-150"
                >
                  Next: {team.shortName} vs {nextOpponent.shortName},{" "}
                  {new Date(nextFixture.kickoffAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </Link>
              </div>
            )}
            <div className="mb-2.5">
              <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase">
                {currentGame && opponent ? (
                  <>
                    Team list for {team.shortName} vs {opponent.shortName}
                  </>
                ) : (
                  "Team list"
                )}
              </h2>
              {currentGame && opponent && (
                <Link
                  to={`/games/${currentGame.id}`}
                  className="text-[11.5px] font-semibold text-white/42 hover:text-white transition-colors duration-150"
                >
                  {currentGame.round} ·{" "}
                  {new Date(currentGame.kickoffAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Link>
              )}
            </div>

            {currentGame && lineupStages ? (
              <TeamListCard team={team} stages={lineupStages} kickoffAt={currentGame.kickoffAt} />
            ) : (
              <p className="text-slate-500 text-sm">No team list logged yet.</p>
            )}

            <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase mt-[26px] mb-2.5">
              Injury list
            </h2>
            {injured.length === 0 ? (
              <p className="text-slate-500 text-sm">No injuries reported.</p>
            ) : (
              <div className="bg-surface border border-white/[.07] rounded-2xl overflow-hidden">
                {injured.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between gap-2.5 px-3.5 py-3 border-b border-white/[.055] last:border-0"
                  >
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[13.5px] font-bold text-white truncate">{player.name}</span>
                      <span className="text-[11px] font-medium text-white/42 truncate">
                        {player.currentStatusNote ?? "No details provided"}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[11px] font-extrabold tracking-[.04em] uppercase whitespace-nowrap ${INJURY_COLOR[player.currentStatus] ?? "text-white/50"}`}>
                      {player.currentStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {recentEvents.length > 0 && (
              <>
                <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase mt-[26px] mb-2.5">
                  {team.shortName} news
                </h2>
                <div>
                  {recentEvents.map((event) => (
                    <EventCard key={event.id} event={event} compact />
                  ))}
                </div>
              </>
            )}

            {socialPosts.length > 0 && (
              <>
                <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase mt-[26px] mb-2.5">
                  Social
                </h2>
                <div>
                  {socialPosts.map((post) => (
                    <EventCard key={post.id} event={post} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
