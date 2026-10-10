import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, EventItem } from "../lib/api";
import { SITE_URL, useDocumentMeta, useJsonLd } from "../lib/useDocumentMeta";
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
    // Every club copy of a story names the same canonical URL.
    path: story?.canonicalPath ?? `/story/${id ?? ""}`,
    type: "article",
    noindex: Boolean(error),
  });
  useJsonLd(
    useMemo(
      () =>
        story
          ? {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: story.headline,
              description: story.body,
              datePublished: story.createdAt,
              mainEntityOfPage: `${SITE_URL}${story.canonicalPath ?? `/story/${story.id}`}`,
              publisher: { "@type": "Organization", name: "Full Set", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` } },
              ...(story.sourceAuthor ? { author: story.sourceAuthor.split(/,s*/).map((name) => ({ "@type": "Person", name })) } : {}),
              ...(story.sourceUrl ? { isBasedOn: story.sourceUrl } : {}),
            }
          : null,
      [story]
    )
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <Link to="/news" className="inline-block text-[13px] font-bold text-brand-violet hover:text-brand-hover">
        ← All news
      </Link>
      {error && <p className="text-slate-400 text-sm">That story isn't available any more.</p>}
      {!story && !error && <FeedSkeleton count={1} />}
      {story && <EventCard event={story} headingLevel="h1" />}
    </div>
  );
}
