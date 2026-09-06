import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, SearchResult } from "../lib/api";

// Tried in order when GET /api/search/trending has no clear signal (fewer
// than 2 podcast mentions of any one player in the last 7 days) — each is
// evergreen enough to almost always return something. Not itself meant to
// rotate; resolveQuery below just walks it until one search actually
// returns a qualifying result.
const FALLBACK_TOPICS = ["NRL Finals", "State of Origin", "Grand Final", "Judiciary"];

// Temporary pin, set 2026-09-07: swapped from the default trending pick
// ("Sam Walker") to Cam Munster per direct request. Once PIN_UNTIL passes,
// this block is simply skipped and resolution falls straight back through
// to normal trending/fallback behavior — nothing else needs to be reverted
// by hand.
const PINNED_TOPIC = "Cameron Munster";
const PIN_UNTIL = new Date("2026-09-09T09:00:00Z").getTime();

const ChevronRight = () => (
  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="shrink-0">
    <path d="M1 4.5h8M6 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Prefers a real spoken excerpt over a mere label/description, and the most
// recently published one within whichever kind wins. "transcript" is an
// actual Whisper-transcribed sentence (dormant today — no OPENAI_API_KEY,
// see routes/search.ts — but wired for when that roadmap item ships).
// "chapter" is a creator-written chapter marker, "episode" is just the
// video's own title/description. Only "transcript" is a genuine quote of
// something said; the render below relies on that distinction to decide
// whether to use quotation marks at all.
const KIND_RANK: Record<SearchResult["kind"], number> = { transcript: 0, chapter: 1, episode: 2 };

function pickBestResult(results: SearchResult[]): SearchResult | null {
  if (results.length === 0) return null;
  return [...results].sort((a, b) => {
    const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rank !== 0) return rank;
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  })[0];
}

// Picks what to search for: the player most mentioned across recent
// podcast content (GET /api/search/trending — cross-references real Player
// names against Episode/ExternalEpisode titles+descriptions server-side,
// see routes/search.ts) when there's a clear signal, otherwise walks
// FALLBACK_TOPICS until one actually returns a qualifying result. Never
// just returns a topic blind — always confirms it has a real result to
// show before committing to it, so the card can't end up searching for
// something that turns up empty.
async function resolveQueryAndResult(): Promise<{ query: string; result: SearchResult } | null> {
  if (Date.now() < PIN_UNTIL) {
    try {
      const best = pickBestResult(await api.search(PINNED_TOPIC));
      if (best) return { query: PINNED_TOPIC, result: best };
    } catch {
      // fall through to normal resolution below
    }
  }

  try {
    const { topic } = await api.getTrendingTopic();
    if (topic) {
      const best = pickBestResult(await api.search(topic));
      if (best) return { query: topic, result: best };
    }
  } catch {
    // fall through to the fallback list below
  }

  for (const topic of FALLBACK_TOPICS) {
    try {
      const best = pickBestResult(await api.search(topic));
      if (best) return { query: topic, result: best };
    } catch {
      // try the next fallback
    }
  }
  return null;
}

// A live example of "What's Been Said" right on Home, rather than just
// describing the feature — a first-time visitor sees a real result within
// a few seconds instead of reading marketing copy about it. Self-updating:
// the topic searched isn't hardcoded, it's resolved fresh on every load
// (see resolveQueryAndResult above), so this never goes stale on its own.
// Deliberately built to the same card shape as EventCard (kicker row,
// headline, body, divider + CTA footer) rather than a one-off widget, so
// it reads as another card in the feed, not a bolted-on component.
// undefined = still loading, null = nothing worth showing (fails quiet).
export default function WhatsBeenSaidTeaser() {
  const [state, setState] = useState<{ query: string; result: SearchResult } | null | undefined>(undefined);

  useEffect(() => {
    resolveQueryAndResult().then(setState);
  }, []);

  if (state === null) return null;

  return (
    <Link
      to={`/search?q=${encodeURIComponent(state?.query ?? "")}`}
      className="block bg-surface border border-white/[.07] rounded-[14px] px-[15px] pt-[15px] pb-[13px] hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="flex items-center gap-2 mb-[9px]">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
          What's Been Said
        </span>
        {state && (
          <>
            <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
            <span className="text-[11px] font-semibold text-white/38 truncate">searched &ldquo;{state.query}&rdquo;</span>
          </>
        )}
      </div>

      {/* Only "transcript" results are an actual spoken excerpt (see
          pickBestResult above) — "chapter" and "episode" are a label or a
          video description, not something anyone said on air. Quoting
          those would misrepresent them as real quotes (they previously
          were, including the episode title showing up quoted with its own
          emoji intact), so only the transcript case gets quotation marks;
          everything else gets an honest "Discussed on" line instead, with
          the episode title underneath rather than the podcast name
          repeated a second time. */}
      {state === undefined ? (
        <div className="space-y-1.5">
          <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-white/[.06] rounded animate-pulse" />
        </div>
      ) : state.result.kind === "transcript" ? (
        <>
          <p className="text-[14.5px] leading-snug text-white/92 line-clamp-2">
            &ldquo;{state.result.snippet}&rdquo;
          </p>
          <p className="mt-1 text-[12px] font-bold text-white/75 truncate">
            {state.result.podcast} — {state.result.episodeTitle}
          </p>
        </>
      ) : (
        <>
          <p className="text-[14.5px] leading-snug font-bold text-white/92 truncate">
            Discussed on {state.result.podcast}
          </p>
          <p className="mt-1 text-[12px] font-bold text-white/75 truncate">{state.result.episodeTitle}</p>
        </>
      )}

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[.06]">
        <span className="text-[11.5px] font-semibold text-white/46">Search what else they're saying</span>
        <span className="shrink-0 flex items-center gap-[5px] text-xs font-extrabold tracking-[.02em] text-brand-violet">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}
