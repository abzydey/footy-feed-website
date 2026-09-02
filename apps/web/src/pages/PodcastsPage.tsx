import { useEffect, useMemo, useState } from "react";

import { api, Episode } from "../lib/api";
import { getYouTubeEmbedUrl, getYouTubeVideoId, YOUTUBE_THUMBNAIL_QUALITIES } from "../lib/youtube";
import { Skeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className="shrink-0 translate-x-[1px]">
      <path d="M5 3.5L18 11L5 18.5V3.5Z" fill="white" />
    </svg>
  );
}

// maxresdefault.jpg (1280x720) doesn't exist for every video — when it's
// missing YouTube serves a tiny 120x90 grey placeholder instead of a real
// 404 in some cases, so onError alone can't be trusted. Checks the loaded
// image's actual size too, stepping down through sddefault/hqdefault (which
// YouTube generates for every video) until one is a real photo, not the
// placeholder.
function VideoThumbnail({ url }: { url: string }) {
  const [qualityIndex, setQualityIndex] = useState(0);
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;

  const quality = YOUTUBE_THUMBNAIL_QUALITIES[qualityIndex];
  const isLastQuality = qualityIndex === YOUTUBE_THUMBNAIL_QUALITIES.length - 1;

  function stepDown() {
    setQualityIndex((i) => Math.min(i + 1, YOUTUBE_THUMBNAIL_QUALITIES.length - 1));
  }

  return (
    <img
      src={`https://i.ytimg.com/vi/${videoId}/${quality}.jpg`}
      alt=""
      loading="lazy"
      className="w-full h-full object-cover"
      onError={() => !isLastQuality && stepDown()}
      onLoad={(e) => {
        const img = e.currentTarget;
        // YouTube's "no maxres available" placeholder is exactly 120x90.
        if (!isLastQuality && img.naturalWidth === 120 && img.naturalHeight === 90) stepDown();
      }}
    />
  );
}

// A compact row (small thumbnail + two-line title) rather than a full-width
// video-preview card, so several episodes fit on a phone screen at once —
// tapping one expands it in place to a full-width player, rather than every
// episode mounting a live YouTube player (or a large always-visible
// thumbnail) up front.
function EpisodeCard({ episode }: { episode: Episode }) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = getYouTubeEmbedUrl(episode.audioUrl);

  if (playing && embedUrl) {
    return (
      <article className="rounded-xl bg-surface border border-white/10 shadow-card overflow-hidden">
        <div className="aspect-video bg-black">
          <iframe
            src={`${embedUrl}?autoplay=1`}
            title={episode.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        <div className="px-3 py-2.5">
          <div className="text-[11px] text-slate-500 mb-0.5">
            {episode.podcast.name} · {formatDate(episode.publishedAt)}
          </div>
          <h3 className="font-display font-bold text-sm text-white leading-snug">{episode.title}</h3>
        </div>
      </article>
    );
  }

  const content = (
    <>
      <div className="relative w-[104px] h-[59px] shrink-0 rounded-lg overflow-hidden bg-black">
        {embedUrl && <VideoThumbnail url={episode.audioUrl} />}
        {embedUrl && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-violet/90">
              <PlayIcon size={13} />
            </span>
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="text-[10.5px] text-slate-500 mb-1 truncate">
          {episode.podcast.name} · {formatDate(episode.publishedAt)}
        </div>
        <h3 className="font-display font-bold text-[13px] leading-snug text-white [text-wrap:pretty] line-clamp-2">
          {episode.title}
        </h3>
      </div>
    </>
  );

  const rowClass =
    "flex items-start gap-3 w-full text-left rounded-xl bg-surface border border-white/10 shadow-card p-2.5 hover:border-white/20 transition-colors duration-150";

  if (!embedUrl) {
    return (
      <a href={episode.audioUrl} target="_blank" rel="noreferrer" className={rowClass}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={() => setPlaying(true)} className={rowClass} aria-label={`Play ${episode.title}`}>
      {content}
    </button>
  );
}

function EpisodeCardSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface border border-white/10 shadow-card p-2.5">
      <Skeleton className="w-[104px] h-[59px] shrink-0 rounded-lg" />
      <div className="flex-1 py-0.5 space-y-1.5">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

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
    api.listEpisodesBrowse().then(setEpisodes).catch((err) => setError(err.message));
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
