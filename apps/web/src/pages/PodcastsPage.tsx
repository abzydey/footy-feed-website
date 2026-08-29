import { useEffect, useState } from "react";

import { api, Episode } from "../lib/api";
import { getYouTubeEmbedUrl } from "../lib/youtube";
import { Skeleton } from "../components/ui/Skeleton";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const embedUrl = getYouTubeEmbedUrl(episode.audioUrl);
  return (
    <article className="rounded-xl bg-surface border border-white/10 shadow-card overflow-hidden">
      {embedUrl ? (
        <div className="aspect-video bg-black">
          <iframe
            src={embedUrl}
            title={episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      ) : (
        <a
          href={episode.audioUrl}
          target="_blank"
          rel="noreferrer"
          className="block p-4 text-brand-heliotrope hover:text-white transition-colors duration-150 text-sm"
        >
          Watch/listen →
        </a>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
          <span>{formatDate(episode.publishedAt)}</span>
        </div>
        <h3 className="font-display font-extrabold text-lg sm:text-xl text-white tracking-tight leading-tight">
          {episode.title}
        </h3>
        {episode.description && (
          <p className="text-slate-300 text-sm leading-relaxed mt-1">{episode.description}</p>
        )}
      </div>
    </article>
  );
}

function EpisodeCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface border border-white/10 shadow-card overflow-hidden">
      <div className="aspect-video">
        <Skeleton className="w-full h-full rounded-none" />
      </div>
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
      </div>
    </div>
  );
}

export default function PodcastsPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listEpisodesBrowse().then(setEpisodes).catch((err) => setError(err.message));
  }, []);

  const showNames = Array.from(new Set(episodes?.map((e) => e.podcast.slug) ?? []));
  const groupByShow = showNames.length > 1;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-white">Podcasts</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!episodes && !error && (
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <EpisodeCardSkeleton key={i} />
          ))}
        </div>
      )}
      {episodes && episodes.length === 0 && <p className="text-slate-500 text-sm">No episodes yet.</p>}

      {episodes && !groupByShow && (
        <div className="space-y-5">
          {episodes.map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      )}

      {episodes &&
        groupByShow &&
        showNames.map((slug) => {
          const showEpisodes = episodes.filter((e) => e.podcast.slug === slug);
          return (
            <section key={slug} className="space-y-3">
              <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider">
                {showEpisodes[0]?.podcast.name}
              </h2>
              <div className="space-y-5">
                {showEpisodes.map((episode) => (
                  <EpisodeCard key={episode.id} episode={episode} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
