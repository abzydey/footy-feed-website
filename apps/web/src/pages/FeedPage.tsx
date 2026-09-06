import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, EventItem, Team } from "../lib/api";
import { dedupeStories } from "../lib/feed";
import { getStoredFcmToken } from "../lib/push";
import EventCard from "../components/EventCard";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

type View = "top" | "my-teams" | "signings";

const VIEW_META: Record<View, { title: string; subtitle: string; empty: string }> = {
  top: {
    title: "Top Stories",
    subtitle: "Everything across the league — news and signings, newest first.",
    empty: "No stories yet.",
  },
  "my-teams": {
    title: "My Teams",
    subtitle: "News for the clubs you follow.",
    empty: "No news for your followed teams yet.",
  },
  signings: {
    title: "Signing News",
    subtitle: "Every confirmed signing, release, and retirement across the league.",
    empty: "No signing news yet.",
  },
};

// One page for what used to be three of Home's in-place feed-filter chips
// (Top/My Teams/Signing News) — those chips were confusing as filters
// because the highlighted pill and the filtered content it changed could
// both be off-screen at once, so tapping one gave no visible confirmation
// anything happened. A real navigation (this page) removes that ambiguity:
// tap a pill, you're taken somewhere. Judiciary already had its own page;
// this just brings the other three in line with that same model instead of
// trying to force Judiciary into an in-place filter it never fit.
export default function FeedPage() {
  const { view } = useParams<{ view: string }>();
  const meta = VIEW_META[(view as View) in VIEW_META ? (view as View) : "top"];

  const [feed, setFeed] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [followedTeamIds, setFollowedTeamIds] = useState<string[]>([]);

  useDocumentMeta({
    title: meta.title,
    description: meta.subtitle,
    path: `/feed/${view}`,
  });

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

  const items = useMemo(() => {
    if (!feed) return null;
    if (view === "my-teams") {
      if (followedTeamNames.length === 0) return [];
      return dedupeStories(
        feed.filter((a) =>
          followedTeamNames.some((name) => (a.headline + " " + a.body).toLowerCase().includes(name.toLowerCase()))
        )
      );
    }
    if (view === "signings") return dedupeStories(feed.filter((a) => a.type === "TRANSFER"));
    return dedupeStories(feed);
  }, [feed, view, followedTeamNames]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <PageHero title={meta.title} subtitle={meta.subtitle} />

      {view === "my-teams" && followedTeamIds.length === 0 && (
        <p className="text-[13px] font-semibold text-white/50">
          You're not following any teams yet.{" "}
          <Link to="/teams" className="text-brand-violet hover:underline">
            Pick your teams
          </Link>{" "}
          to see their news here.
        </p>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!feed && !error && <FeedSkeleton count={5} />}
      {items && items.length === 0 && (
        <p className="text-[13.5px] font-semibold text-white/50 text-center mt-6">{meta.empty}</p>
      )}
      <div>{items?.map((event) => <EventCard key={event.id} event={event} />)}</div>
    </div>
  );
}
