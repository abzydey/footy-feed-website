import { useEffect, useMemo, useState } from "react";

import { api, Episode } from "../lib/api";
import { EpisodeCard, EpisodeCardSkeleton } from "../components/EpisodeCard";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// NRL Highlights has its own dedicated page (HighlightsPage) — excluded
// here so match-highlight clips don't show up twice.
const EXCLUDED_PODCAST_SLUG = "nrl-highlights";

export default function PodcastsPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("all");

  useDocumentMeta({
    title: "NRL Podcasts",
    description: "The latest NRL podcast episodes — panel shows, interviews, and analysis, all in one place.",
    path: "/podcasts",
  });

  useEffect(() => {
    api
      .listEpisodesBrowse()
      .then((eps) => setEpisodes(eps.filter((ep) => ep.podcast.slug !== EXCLUDED_PODCAST_SLUG)))
      .catch((err) => setError(err.message));
  }, []);

  // Each curated Podcast row is sourced from one YouTube channel, so
  // filtering by podcast.slug is filtering by channel — no separate channel
  // list needed. Options are derived from whatever's actually in the
  // episode list (in first-seen order, which is newest-first since that's
  // the API's own order) rather than a hardcoded list, so a newly-added
  // show just shows up here automatically.
  const channels = useMemo(() => {
    if (!episodes) return [];
    const seen = new Map<string, string>();
    for (const ep of episodes) {
      if (!seen.has(ep.podcast.slug)) seen.set(ep.podcast.slug, ep.podcast.name);
    }
    return Array.from(seen, ([slug, name]) => ({ slug, name }));
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    if (!episodes) return null;
    if (channelFilter === "all") return episodes;
    return episodes.filter((ep) => ep.podcast.slug === channelFilter);
  }, [episodes, channelFilter]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Podcasts</h1>
        {channels.length > 1 && (
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="bg-surface border border-white/15 rounded-lg text-[13px] font-semibold text-white pl-3 pr-8 py-2 focus:outline-none focus:border-brand-violet transition-colors duration-150"
          >
            <option value="all">All shows</option>
            {channels.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!episodes && !error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </div>
      )}
      {filteredEpisodes && filteredEpisodes.length === 0 && (
        <p className="text-slate-500 text-sm">No episodes {channelFilter === "all" ? "yet" : "from this show yet"}.</p>
      )}

      {filteredEpisodes && filteredEpisodes.length > 0 && (
        <div className="space-y-2">
          {filteredEpisodes.map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      )}
    </div>
  );
}
