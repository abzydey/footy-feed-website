import { useEffect, useState } from "react";

import { api, EventItem } from "../lib/api";
import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";
import EventCard from "../components/EventCard";
import FollowButton from "../components/FollowButton";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

/**
 * The dedicated page for the "General NRL News" follow target (LEAGUE) —
 * same pattern as a team or game page: its own header with a Follow button,
 * and its own list of related content. Reuses GET /api/feed (no separate
 * endpoint needed) but filters down to GENERAL_NEWS only — that endpoint
 * also carries TRANSFER events for Home's "Signing News" chip (see
 * routes/feed.ts), which don't belong on a page explicitly described as
 * "not tied to one team."
 */
export default function GeneralNewsPage() {
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "General NRL News",
    description: "Breaking league-wide NRL stories, not tied to one club.",
    path: "/news",
  });

  useEffect(() => {
    api
      .getFeed()
      .then((feed) => setItems(feed.filter((e) => e.type === "GENERAL_NEWS")))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <PageHero title="General NRL News" subtitle="Breaking league-wide stories, not tied to one team.">
        <FollowButton targetType="LEAGUE" targetId={GENERAL_NEWS_TARGET_ID} />
      </PageHero>

      <section>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!items && !error && <FeedSkeleton count={4} />}
        {items && items.length === 0 && <p className="text-slate-500 text-sm">No news yet.</p>}
        <div>
          {items?.map((item) => (
            <EventCard key={item.id} event={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
