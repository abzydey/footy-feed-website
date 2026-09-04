import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, SearchResult } from "../lib/api";

// A real, currently-topical query — not necessarily every result it turns
// up is great, so pickBestResult below still has to choose carefully, but
// this keeps the odds high of landing on something genuinely worth showing.
// Swap this out as whatever's dominating the news cycle changes.
const TEASER_QUERY = "Jai Arrow";

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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
// a few seconds instead of reading marketing copy about it. undefined =
// still loading, null = nothing worth showing (fails quiet — no broken/
// empty card), a SearchResult = found something real to show.
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
      className="block rounded-xl bg-surface border border-white/10 shadow-card p-3.5 hover:border-white/20 transition-colors duration-150 active:scale-[0.99]"
    >
      <div className="text-[11px] font-bold text-brand-heliotrope uppercase tracking-wider mb-2">What's Been Said</div>
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-3 text-slate-400">
        <SearchIcon />
        <span className="text-sm text-white/70">{TEASER_QUERY}</span>
      </div>

      {result === undefined ? (
        <div className="space-y-1.5 animate-pulse">
          <div className="h-2.5 w-24 bg-white/10 rounded" />
          <div className="h-3.5 w-full bg-white/10 rounded" />
          <div className="h-3.5 w-2/3 bg-white/10 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <span className="font-bold text-white/70">{result.podcast}</span>
            <span>{formatWhen(result.publishedAt)}</span>
          </div>
          <p className="text-white text-sm font-semibold leading-snug mb-1 line-clamp-1">{result.episodeTitle}</p>
          <p className="text-slate-400 text-[13px] leading-relaxed line-clamp-2">&ldquo;{result.snippet}&rdquo;</p>
        </>
      )}

      <div className="text-xs font-bold text-brand-heliotrope mt-2.5">See what else they're saying →</div>
    </Link>
  );
}
