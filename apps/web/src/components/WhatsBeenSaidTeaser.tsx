import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, SearchResult } from "../lib/api";

// Tried in order when GET /api/search/trending has no clear signal (fewer
// than 2 podcast mentions of any one player in the last 7 days) — each is
// evergreen enough to almost always return something. Not itself meant to
// rotate; resolveQuery below just walks it until one search actually
// returns a qualifying result.
const FALLBACK_TOPICS = ["NRL Finals", "State of Origin", "Grand Final", "Judiciary"];

// Temporary pin, set 2026-09-04: "Keep on Jai Arrow search for at least 24
// hours" — his 100th-game milestone is the story tonight, and the normal
// self-updating trending-topic logic (still runs underneath, see
// resolveQueryAndResult below) could otherwise hand the teaser to whatever
// else picks up podcast mentions before this story's had its full run.
// Once PIN_UNTIL passes, this block is simply skipped and resolution falls
// straight back through to normal trending/fallback behavior — nothing
// else needs to be reverted by hand.
const PINNED_TOPIC = "Jai Arrow";
const PIN_UNTIL = new Date("2026-09-05T09:00:00Z").getTime();

const ChevronRight = () => (
  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="shrink-0">
    <path d="M1 4.5h8M6 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Prefers a rich episode-description match (a real sentence, not a terse
// chapter-marker label) and the most recently published one, so the card
// shows something that reads like a genuine "look what they're saying"
// moment rather than a three-word fragment. Falls back to whatever search
// actually returns if nothing meets that bar, rather than showing nothing.
function pickBestResult(results: SearchResult[]): SearchResult | null {
  const rich = results.filter((r) => r.kind === "episode" && r.snippet.trim().length > 20);
  const pool = rich.length > 0 ? rich : results;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  })[0];
}

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

      {state === undefined ? (
        <div className="space-y-1.5 animate-pulse py-0.5">
          <div className="h-2.5 w-24 bg-white/10 rounded" />
          <div className="h-3.5 w-full bg-white/10 rounded" />
          <div className="h-3.5 w-2/3 bg-white/10 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/46 mb-1">
            <span className="text-brand-heliotrope font-bold">{state.result.podcast}</span>
            <span>· {formatWhen(state.result.publishedAt)}</span>
          </div>
          <h3 className="font-extrabold text-white tracking-[-.018em] text-[17px] leading-[1.2] [text-wrap:pretty] line-clamp-2">
            {state.result.episodeTitle}
          </h3>
          <p className="text-white/56 leading-[1.48] text-[13px] mt-[7px] [text-wrap:pretty] line-clamp-2">
            &ldquo;{state.result.snippet}&rdquo;
          </p>
        </>
      )}

      <div className="flex items-center justify-between mt-[13px] pt-3 border-t border-white/[.06]">
        <span className="text-[11.5px] font-semibold text-white/46">Search what else they're saying</span>
        <span className="shrink-0 flex items-center gap-[5px] text-xs font-extrabold tracking-[.02em] text-brand-violet">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}
