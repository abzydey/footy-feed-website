import { FormEvent, useState } from "react";

import { api } from "../lib/api";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.search>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-bold text-white mb-4">Podcast search</h1>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search what's been said, e.g. 'Broncos halfback'"
          className="flex-1 rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium px-4 py-2"
        >
          Search
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {results && results.length === 0 && <p className="text-slate-500 text-sm">No matches.</p>}

      <div className="space-y-3">
        {results?.map((r, i) => (
          <a
            key={i}
            href={`${r.audioUrl}#t=${Math.floor(r.startSeconds)}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-4"
          >
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{r.podcast}</span>
              <span className="font-mono">{formatTime(r.startSeconds)}</span>
            </div>
            <div className="text-white text-sm font-medium">{r.episodeTitle}</div>
            <p className="text-slate-300 text-sm mt-1">"{r.snippet}"</p>
          </a>
        ))}
      </div>
    </div>
  );
}
