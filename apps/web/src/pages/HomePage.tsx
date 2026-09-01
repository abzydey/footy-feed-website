import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, EventItem, Team } from "../lib/api";
import { getStoredFcmToken } from "../lib/push";
import EventCard from "../components/EventCard";
import GeneralNewsFollow from "../components/GeneralNewsFollow";
import NextGameCard from "../components/NextGameCard";
import TeamListsCard from "../components/TeamListsCard";
import { FeedSkeleton } from "../components/ui/Skeleton";

// "Top" shows everything GET /feed returns (GENERAL_NEWS + TRANSFER — see
// routes/feed.ts). "My Teams" filters that same set to followed clubs.
// "Signing News" filters to TRANSFER specifically — real content now that
// signings are part of the feed, not the empty stub this used to be.
// "Analysis" was dropped per user request. "Ladder" isn't a filter at all —
// it deep-links to the Ladder page.
const CHIPS = ["Top", "My Teams", "Signing News"] as const;
type Chip = (typeof CHIPS)[number];

export default function HomePage() {
  const [feed, setFeed] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [followedTeamIds, setFollowedTeamIds] = useState<string[]>([]);
  const [chip, setChip] = useState<Chip>("Top");

  useEffect(() => {
    api.getFeed().then(setFeed).catch((err) => setError(err.message));
    api.listTeams().then(setTeams).catch(() => setTeams([]));

    const fcmToken = getStoredFcmToken();
    if (fcmToken) {
      api
        .myFollows(fcmToken)
        .then((follows) => setFollowedTeamIds(follows.filter((f) => f.targetType === "TEAM").map((f) => f.targetId)))
        .catch(() => setFollowedTeamIds([]));
    }
  }, []);

  const followedTeamNames = useMemo(
    () => teams.filter((t) => followedTeamIds.includes(t.id)).flatMap((t) => [t.name, t.shortName]),
    [teams, followedTeamIds]
  );

  const articles = useMemo(() => {
    if (!feed) return null;
    if (chip === "Top") return feed;
    if (chip === "My Teams") {
      if (followedTeamNames.length === 0) return [];
      return feed.filter((a) =>
        followedTeamNames.some((name) => (a.headline + " " + a.body).toLowerCase().includes(name.toLowerCase()))
      );
    }
    // Signing News
    return feed.filter((a) => a.type === "TRANSFER");
  }, [feed, chip, followedTeamNames]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CHIPS.map((c) => {
          const active = chip === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={`shrink-0 font-sans text-[12.5px] font-bold tracking-[.02em] px-3.5 py-2 rounded-full whitespace-nowrap transition-colors duration-150 border ${
                active
                  ? "bg-brand-violet text-white border-transparent"
                  : "bg-white/[.04] text-white/60 border-white/[.14] hover:text-white"
              }`}
            >
              {c}
            </button>
          );
        })}
        <Link
          to="/ladder"
          className="shrink-0 font-sans text-[12.5px] font-bold tracking-[.02em] px-3.5 py-2 rounded-full whitespace-nowrap bg-white/[.04] text-white/60 border border-white/[.14] hover:text-white transition-colors duration-150"
        >
          Ladder
        </Link>
      </div>

      <NextGameCard />
      <TeamListsCard />
      <GeneralNewsFollow />

      <div className="flex items-baseline justify-between">
        <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">
          {chip === "Top" ? "Latest" : chip}
        </h2>
        {articles && <span className="text-[11.5px] font-semibold text-white/40">{articles.length} stories</span>}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!feed && !error && <FeedSkeleton count={5} />}
      {articles && articles.length === 0 && (
        <p className="text-[13.5px] font-semibold text-white/50 text-center mt-6">No stories in {chip} yet.</p>
      )}
      <div>
        {articles?.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
