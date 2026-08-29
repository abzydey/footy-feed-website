import { FormEvent, useEffect, useState } from "react";

import { api, Episode, Podcast } from "../../lib/api";

export default function EpisodeForm({ token }: { token: string }) {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  const [podcastId, setPodcastId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    api.listPodcasts().then((list) => {
      setPodcasts(list);
      if (list.length === 1) setPodcastId(list[0].id);
    });
    refreshEpisodes();
  }, []);

  function refreshEpisodes() {
    api.listEpisodesBrowse().then(setEpisodes);
  }

  async function handleDelete(id: string) {
    await api.adminDeleteEpisode(token, id);
    refreshEpisodes();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await api.adminCreateEpisode(token, {
        podcastId,
        title,
        description: description || undefined,
        audioUrl,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
      });
      setStatus("saved");
      setTitle("");
      setDescription("");
      setAudioUrl("");
      setPublishedAt("");
      refreshEpisodes();
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-surface border border-white/10 shadow-card p-4"
      >
        <select
          value={podcastId}
          onChange={(e) => setPodcastId(e.target.value)}
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        >
          <option value="">Select show…</option>
          {podcasts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Episode title"
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional) — this is what makes the episode searchable via 'What's Been Said', so it's worth including real detail"
          rows={3}
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <input
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          placeholder="YouTube URL"
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <div>
          <label className="text-xs text-slate-500 block mb-1">Published date (optional — defaults to now)</label>
          <input
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            type="datetime-local"
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </div>

        <button
          disabled={status === "saving"}
          className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
        >
          {status === "saving" ? "Saving…" : "Add episode"}
        </button>
        {status === "saved" && <p className="text-emerald-400 text-sm">Episode added.</p>}
        {status === "error" && <p className="text-red-400 text-sm">Failed to save.</p>}
      </form>

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">Recent episodes</h2>
        <div>
          {episodes.map((episode) => (
            <div key={episode.id} className="border-b border-white/10 py-3 text-sm flex items-start justify-between gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{episode.podcast.name}</span>
                  <span>{episode.publishedAt ? new Date(episode.publishedAt).toLocaleDateString() : ""}</span>
                </div>
                <div className="text-white font-bold">{episode.title}</div>
              </div>
              <button
                onClick={() => handleDelete(episode.id)}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors duration-150 shrink-0"
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
