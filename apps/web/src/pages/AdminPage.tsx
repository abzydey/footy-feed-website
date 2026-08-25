import { FormEvent, useEffect, useState } from "react";

import { api, EventItem, Player, Team } from "../lib/api";

const TOKEN_KEY = "footy-feed:adminToken";

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  if (!token) return <LoginForm onLogin={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  return <EventForm token={token} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); }} />;
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api.adminLogin(email, password);
      onLogin(token);
    } catch (err) {
      setError("Login failed — check email/password.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto p-4 mt-8 space-y-3">
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-white mb-2">Admin login</h1>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Password"
        className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button className="w-full rounded-md bg-brand-violet hover:bg-brand-violet/90 text-white font-bold px-4 py-2">
        Log in
      </button>
    </form>
  );
}

const EVENT_TYPES = ["NEWS", "INJURY", "LINEUP_CHANGE", "TRANSFER", "GENERAL_NEWS"] as const;
const STATUSES = ["AVAILABLE", "QUESTIONABLE", "OUT", "INJURED", "SUSPENDED"] as const;

function EventForm({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);

  const [teamSlug, setTeamSlug] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("NEWS");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [newStatus, setNewStatus] = useState<(typeof STATUSES)[number] | "">("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    api.listTeams().then(setTeams);
    refreshEvents();
  }, []);

  useEffect(() => {
    if (!teamSlug) { setPlayers([]); return; }
    api.getTeamBrief(teamSlug).then((data) => setPlayers(data.players));
  }, [teamSlug]);

  function refreshEvents() {
    api.adminListEvents(token).then(setRecentEvents).catch(() => onLogout());
  }

  const selectedTeam = teams.find((t) => t.slug === teamSlug);

  const isGeneralNews = type === "GENERAL_NEWS";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await api.adminCreateEvent(token, {
        type,
        // GENERAL_NEWS is league-wide by definition — never send a team/player
        // even if one was left selected from a previous entry.
        teamId: isGeneralNews ? undefined : selectedTeam?.id,
        playerId: isGeneralNews ? undefined : playerId || undefined,
        headline,
        body,
        newStatus: type === "INJURY" ? newStatus || undefined : undefined,
        sourceUrl: sourceUrl || undefined,
      });
      setStatus("saved");
      setHeadline("");
      setBody("");
      setSourceUrl("");
      refreshEvents();
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">Admin — new update</h1>
        <button onClick={onLogout} className="text-xs text-slate-400 hover:underline">
          Log out
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-900 p-4 shadow-lg shadow-black/20">
        <div className={`grid gap-3 ${isGeneralNews ? "grid-cols-1" : "grid-cols-2"}`}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {!isGeneralNews && (
            <select
              value={teamSlug}
              onChange={(e) => { setTeamSlug(e.target.value); setPlayerId(""); }}
              className="rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {isGeneralNews ? (
          <p className="text-xs text-slate-500">
            League-wide — no team or player needed. This goes out to fans following "General NRL News".
          </p>
        ) : (
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
          >
            <option value="">(Team-level — no specific player)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {type === "INJURY" && (
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
            className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
          >
            <option value="">New status…</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline (short)"
          required
          className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Short summary text"
          required
          rows={3}
          className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Source URL (optional)"
          className="w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white"
        />

        <button
          disabled={status === "saving"}
          className="w-full rounded-md bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2"
        >
          {status === "saving" ? "Saving…" : "Publish update"}
        </button>
        {status === "saved" && <p className="text-emerald-400 text-sm">Published — followers notified.</p>}
        {status === "error" && <p className="text-red-400 text-sm">Failed to save.</p>}
      </form>

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wide mb-2">Recent entries</h2>
        <div className="space-y-2">
          {recentEvents.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-800/80 bg-slate-900 p-3 text-sm shadow-md shadow-black/20">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{event.type}</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-white font-bold">{event.headline}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
