import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, EventItem, Team } from "../lib/api";
import { getStoredFcmToken } from "../lib/push";
import EventCard from "../components/EventCard";
import GeneralNewsFollow from "../components/GeneralNewsFollow";
import NextGameCard from "../components/NextGameCard";
import TeamListsCard from "../components/TeamListsCard";
import WhatsBeenSaidTeaser from "../components/WhatsBeenSaidTeaser";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// "Top" shows everything GET /feed returns (GENERAL_NEWS + TRANSFER — see
// routes/feed.ts). "My Teams" filters that same set to followed clubs.
// "Signing News" filters to TRANSFER specifically — real content now that
// signings are part of the feed, not the empty stub this used to be.
// "Analysis" was dropped per user request. "Ladder" isn't a filter at all —
// it deep-links to the Ladder page.
const CHIPS = ["Top", "My Teams", "Signing News"] as const;
type Chip = (typeof CHIPS)[number];

// A story that needs to appear more than once in Event terms — either
// because it's tagged to more than one team (e.g. a signing tagged to both
// the club a player is leaving and the one they're joining) or because it
// also has a separate GENERAL_NEWS copy for the dedicated News page — ends
// up as multiple Event rows sharing one headline/sourceUrl. Each row is
// exactly right for a single team's page, but any list that merges across
// teams/types (Home's "Top"/"My Teams"/"Signing News") would show the same
// story back to back as an apparent duplicate. Collapses that down to one
// card per real story, keeping the first (newest, since feed is already
// sorted) occurrence.
function dedupeStories(items: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.sourceUrl ?? item.headline;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function HomePage() {
  const [feed, setFeed] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [followedTeamIds, setFollowedTeamIds] = useState<string[]>([]);
  const [chip, setChip] = useState<Chip>("Top");

  useDocumentMeta({
    title: "NRL News, Team Lists & Ladder",
    description:
      "Your team. The full set. Real-time NRL news, official team lists, injury updates, fixtures, and ladder standings — one page per club.",
    path: "/",
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

  const articles = useMemo(() => {
    if (!feed) return null;
    if (chip === "Top") return dedupeStories(feed);
    if (chip === "My Teams") {
      if (followedTeamNames.length === 0) return [];
      return dedupeStories(
        feed.filter((a) =>
          followedTeamNames.some((name) => (a.headline + " " + a.body).toLowerCase().includes(name.toLowerCase()))
        )
      );
    }
    // Signing News — narrowed to TRANSFER, but a signing tagged to two
    // teams (leaving club + joining club) is still two rows here, so this
    // needs the same dedupe as "Top"/"My Teams".
    return dedupeStories(feed.filter((a) => a.type === "TRANSFER"));
  }, [feed, chip, followedTeamNames]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <p className="font-display font-bold text-lg sm:text-xl text-white leading-snug [text-wrap:pretty]">
        Every team update, every podcast mention — tracked automatically, before you've even opened the group chat.
      </p>

      <WhatsBeenSaidTeaser />

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
      {/* Horizontally-scrolling carousel rather than stacked cards — the
          full News page (GeneralNewsPage.tsx) keeps the vertical stack,
          this is Home-only so the news section doesn't push everything else
          below the fold. Same scroll-snap technique as NextGameCard's
          fixture carousel. Each card is wrapped rather than restyled so
          EventCard itself (shared with News/TeamPage) stays untouched — the
          wrapper just overrides the card's own mb-3 (meant for vertical
          stacking) since spacing here comes from the flex gap instead. */}
      {articles && articles.length > 0 && (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {articles.map((event) => (
            <div key={event.id} className="snap-start shrink-0 w-[85%] sm:w-[380px] [&>article]:mb-0">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
