import { FormEvent, useEffect, useState } from "react";

import { api, TrackedShow } from "../../lib/api";

export default function TrackedShowsForm({ token }: { token: string }) {
  const [shows, setShows] = useState<TrackedShow[]>([]);
  const [name, setName] = useState("");
  const [youtubeChannelId, setYoutubeChannelId] = useState("");
  const [spotifyShowId, setSpotifyShowId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastIndexed, setLastIndexed] = useState<number | null>(null);

  useEffect(() => {
    refreshShows();
  }, []);

  function refreshShows() {
    api.adminListTrackedShows(token).then(setShows);
  }

  async function handleDelete(id: string) {
    await api.adminDeleteTrackedShow(token, id);
    refreshShows();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      const created = await api.adminCreateTrackedShow(token, {
        name,
        youtubeChannelId: youtubeChannelId || undefined,
        spotifyShowId: spotifyShowId || undefined,
      });
      setStatus("saved");
      setLastIndexed(created.episodesIndexed);
      setName("");
      setYoutubeChannelId("");
      setSpotifyShowId("");
      refreshShows();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-surface border border-white/10 shadow-card p-4"
      >
        <p className="text-xs text-slate-500">
          Track a show by its YouTube channel ID and/or Spotify show ID (either or both). New episodes are picked up
          automatically every 30 min and indexed for "What's Been Said" — this doesn't touch the Podcasts browse
          page, which stays manually curated.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Show name (e.g. "Triple M Rocks Footy NRL")'
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <input
          value={youtubeChannelId}
          onChange={(e) => setYoutubeChannelId(e.target.value)}
          placeholder="YouTube channel ID (starts with UC…, optional)"
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <input
          value={spotifyShowId}
          onChange={(e) => setSpotifyShowId(e.target.value)}
          placeholder="Spotify show ID (optional)"
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />

        <button
          disabled={status === "saving"}
          className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
        >
          {status === "saving" ? "Adding…" : "Track show"}
        </button>
        {status === "saved" && (
          <p className="text-emerald-400 text-sm">
            Added — indexed {lastIndexed} episode{lastIndexed === 1 ? "" : "s"} right away.
          </p>
        )}
        {status === "error" && <p className="text-brand-siren text-sm">{error ?? "Failed to save."}</p>}
      </form>

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">Tracked shows</h2>
        <div>
          {shows.length === 0 && <p className="text-slate-500 text-sm">No shows tracked yet.</p>}
          {shows.map((show) => (
            <div key={show.id} className="border-b border-white/10 py-3 text-sm flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-bold">{show.name}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex gap-2">
                  {show.youtubeChannelId && <span>YouTube</span>}
                  {show.spotifyShowId && <span>Spotify</span>}
                  <span>· {show._count.episodes} episode{show._count.episodes === 1 ? "" : "s"} indexed</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(show.id)}
                className="text-xs text-slate-500 hover:text-brand-siren transition-colors duration-150 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
