import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, SearchResult } from "../lib/api";

// A real, currently-topical query — not necessarily every result it turns
// up is great, so pickBestResult below still has to choose carefully, but
// this keeps the odds high of landing on something genuinely worth showing.
// Swap this out as whatever's dominating the news cycle changes.
const TEASER_QUERY = "Jai Arrow";

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

// A live example of "What's Been Said" right on Home, rather than just
// describing the feature — a first-time visitor sees a real result within
// a few seconds instead of reading marketing copy about it. Deliberately
// built to the same card shape as EventCard (kicker row, headline, body,
// divider + CTA footer) rather than a one-off widget, so it reads as
// another card in the feed, not a bolted-on component. undefined = still
// loading, null = nothing worth showing (fails quiet), a SearchResult =
// found something real.
export default function WhatsBeenSaidTeaser() {
  const [result, setResult] = useState<SearchResult | null | undefined>(undefined);

  useEffect(() => {
    api
      .search(TEASER_QUERY)
      .then((results) => setResult(pickBestResult(results)))
      .catch(() => setResult(null));
  }, []);

  if (result === null) return null;

  return (
    <Link
      to={`/search?q=${encodeURIComponent(TEASER_QUERY)}`}
      className="block bg-surface border border-white/[.07] rounded-[14px] px-[15px] pt-[15px] pb-[13px] hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="flex items-center gap-2 mb-[9px]">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
          What's Been Said
        </span>
        <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
        <span className="text-[11px] font-semibold text-white/38 truncate">searched &ldquo;{TEASER_QUERY}&rdquo;</span>
      </div>

      {result === undefined ? (
        <div className="space-y-1.5 animate-pulse py-0.5">
          <div className="h-2.5 w-24 bg-white/10 rounded" />
          <div className="h-3.5 w-full bg-white/10 rounded" />
          <div className="h-3.5 w-2/3 bg-white/10 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-white/46 mb-1">
            <span className="text-brand-heliotrope font-bold">{result.podcast}</span>
            <span>· {formatWhen(result.publishedAt)}</span>
          </div>
          <h3 className="font-extrabold text-white tracking-[-.018em] text-[17px] leading-[1.2] [text-wrap:pretty] line-clamp-2">
            {result.episodeTitle}
          </h3>
          <p className="text-white/56 leading-[1.48] text-[13px] mt-[7px] [text-wrap:pretty] line-clamp-2">
            &ldquo;{result.snippet}&rdquo;
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
