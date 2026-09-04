import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../lib/api";
import { RowListSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// transcript/chapter results carry a startSeconds and show a timestamp
// instead; episode-level matches (no specific moment) show this label.
const KIND_LABEL: Record<"transcript" | "chapter" | "episode", string> = {
  transcript: "Transcript",
  chapter: "Chapter",
  episode: "Episode",
};

// Today every result happens to be a YouTube video, but tracked shows can
// also come from Spotify (see lib/podcastDiscovery.ts) — label by the
// actual destination rather than hardcoding "Watch" everywhere.
function linkLabel(url: string): string {
  return url.includes("youtube.com") || url.includes("youtu.be") ? "Watch" : "Listen";
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.search>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "Search",
    description: "Search NRL podcast transcripts, chapters, and episodes on Full Set.",
    path: "/search",
  });

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(q));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  // Arriving with ?q= (e.g. the Home page's "What's Been Said" teaser) runs
  // the search immediately, rather than landing on an empty box the query
  // was only ever pre-filled into. Intentionally only on first mount, not
  // whenever searchParams changes — a normal in-page search via the form
  // below shouldn't re-trigger this.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) runSearch(q);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase mb-1.5">
        What's Been Said
      </h1>
      <p className="text-slate-400 text-sm mb-4">
        Search what NRL podcasts, shows, and clips have said about any player, team, or topic.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what's been said, e.g. 'Broncos halfback'"
          className="flex-1 bg-black border border-white/20 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.97]"
        >
          Search
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <RowListSkeleton count={3} />}
      {results && results.length === 0 && <p className="text-slate-500 text-sm">No matches.</p>}

      <div>
        {results?.map((r, i) => (
          <article key={i} className="border-b border-white/10 py-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span className="font-bold text-brand-heliotrope uppercase tracking-wider">{r.podcast}</span>
              {r.startSeconds !== null ? (
                <span className="font-mono">{formatTime(r.startSeconds)}</span>
              ) : (
                <span className="uppercase tracking-wider">{KIND_LABEL[r.kind]}</span>
              )}
            </div>
            <div className="text-white font-display font-extrabold text-lg sm:text-xl leading-tight">
              {r.episodeTitle}
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mt-1">"{r.snippet}"</p>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-heliotrope hover:text-white transition-colors duration-150 mt-2 inline-block"
            >
              {linkLabel(r.url)} →
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
