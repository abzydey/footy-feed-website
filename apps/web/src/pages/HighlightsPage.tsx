import { useEffect, useState } from "react";

import { api, Episode } from "../lib/api";
import { EpisodeCard, EpisodeCardSkeleton } from "../components/EpisodeCard";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// The one podcast bucket episodeAutoPoller.ts feeds for match highlights
// (NRL on Nine's "NRL Highlights: ..." uploads only) — see that file for
// the source config.
const HIGHLIGHTS_PODCAST_SLUG = "nrl-highlights";

export default function HighlightsPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL Highlights",
    description: "Full match highlights from every NRL game, as they're posted.",
    path: "/highlights",
  });

  useEffect(() => {
    api
      .listEpisodesBrowse()
      .then((eps) => setEpisodes(eps.filter((ep) => ep.podcast.slug === HIGHLIGHTS_PODCAST_SLUG)))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Highlights</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!episodes && !error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </div>
      )}
      {episodes && episodes.length === 0 && <p className="text-slate-500 text-sm">No highlights yet.</p>}
      {episodes && episodes.length > 0 && (
        <div className="space-y-2">
          {episodes.map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      )}
    </div>
  );
}
