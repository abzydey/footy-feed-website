import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Episode } from "../lib/api";
import { formatDate } from "./EpisodeCard";

// Same exclusion PodcastsPage uses — Highlights clips have their own
// dedicated page/card elsewhere, so they shouldn't surface here as if they
// were the "latest podcast episode".
const EXCLUDED_PODCAST_SLUG = "nrl-highlights";

const PlayIcon = () => (
  <svg width="11" height="13" viewBox="0 0 11 13" fill="none" className="shrink-0 translate-x-[1px]">
    <path d="M0.5 1L10.5 6.5L0.5 12V1Z" fill="white" />
  </svg>
);

const ChevronRight = () => (
  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="shrink-0">
    <path d="M1 4.5h8M6 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Same card shell as WhatsBeenSaidTeaser (kicker row, content, divider +
// CTA footer) since both are podcast-sourced Home teasers meant to read as
// a matched pair — but a distinct middle section (play icon + title, no
// quote/attribution split) so the two don't collapse into looking like one
// repeated component. Routes to the Podcasts page on tap rather than
// playing inline (EpisodeCard's own behaviour) — this is a teaser pointing
// at the full page, not a player in its own right.
export default function LatestEpisodeTeaser() {
  const [episode, setEpisode] = useState<Episode | null | undefined>(undefined);

  useEffect(() => {
    api
      .listEpisodesBrowse()
      .then((eps) => setEpisode(eps.find((ep) => ep.podcast.slug !== EXCLUDED_PODCAST_SLUG) ?? null))
      .catch(() => setEpisode(null));
  }, []);

  if (episode === null) return null;

  return (
    <Link
      to="/podcasts"
      className="block bg-surface border border-white/[.07] rounded-[14px] px-[15px] pt-[15px] pb-[13px] hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="flex items-center gap-2 mb-[9px]">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
          Latest Episode
        </span>
        {episode && (
          <>
            <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
            <span className="text-[11px] font-semibold text-white/38 truncate">
              {episode.podcast.name}
              {episode.publishedAt ? ` · ${formatDate(episode.publishedAt)}` : ""}
            </span>
          </>
        )}
      </div>

      {episode === undefined ? (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-white/10 animate-pulse" />
          <div className="h-4 flex-1 bg-white/10 rounded animate-pulse" />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-brand-violet/90">
            <PlayIcon />
          </span>
          <p className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug text-white truncate">{episode.title}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[.06]">
        <span className="text-[11.5px] font-semibold text-white/46">Listen on Podcasts</span>
        <span className="shrink-0 flex items-center gap-[5px] text-xs font-extrabold tracking-[.02em] text-brand-violet">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}
