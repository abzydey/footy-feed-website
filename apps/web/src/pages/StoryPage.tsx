import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, EventItem } from "../lib/api";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import EventCard from "../components/EventCard";
import { FeedSkeleton } from "../components/ui/Skeleton";

// One news or signings story on its own page — where a headline from Home's
// headline list opens. Shows the full card (summary, source, read-more link
// to the outlet) and a way back to all news.
export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getStory(id).then(setStory).catch((err) => setError(err.message));
  }, [id]);

  useDocumentMeta({
    title: story?.headline ?? "NRL News",
    description: story?.body?.slice(0, 155) ?? "NRL news on Full Set.",
    path: `/story/${id ?? ""}`,
  });

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Link to="/news" className="inline-block text-[13px] font-bold text-brand-violet hover:text-brand-hover">
        ← All news
      </Link>
      {error && <p className="text-slate-400 text-sm">That story isn't available any more.</p>}
      {!story && !error && <FeedSkeleton count={1} />}
      {story && <EventCard event={story} />}
    </div>
  );
}
