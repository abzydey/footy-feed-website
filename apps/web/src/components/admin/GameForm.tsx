import { FormEvent, useEffect, useState } from "react";

import { api, Game, Team } from "../../lib/api";

interface TryRow {
  scorer: string;
  minute: string;
}

const emptyTryRow: TryRow = { scorer: "", minute: "" };

function TrySection({
  label,
  rows,
  onChange,
}: {
  label: string;
  rows: TryRow[];
  onChange: (rows: TryRow[]) => void;
}) {
  function updateRow(i: number, field: keyof TryRow, value: string) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label} tries</h4>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={row.scorer}
            onChange={(e) => updateRow(i, "scorer", e.target.value)}
            placeholder="Scorer name"
            className="flex-1 min-w-0 bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
          <input
            value={row.minute}
            onChange={(e) => updateRow(i, "minute", e.target.value)}
            placeholder="Min"
            inputMode="numeric"
            className="w-16 shrink-0 bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="shrink-0 text-slate-500 hover:text-red-400 px-1.5 transition-colors duration-150"
            aria-label="Remove try"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...emptyTryRow }])}
        className="text-xs font-bold text-brand-heliotrope hover:underline"
      >
        + Add try
      </button>
    </div>
  );
}

function ResultForm({ token, game, onSaved }: { token: string; game: Game; onSaved: () => void }) {
  const [homeScore, setHomeScore] = useState(game.homeScore != null ? String(game.homeScore) : "");
  const [awayScore, setAwayScore] = useState(game.awayScore != null ? String(game.awayScore) : "");
  const [homeTries, setHomeTries] = useState<TryRow[]>([]);
  const [awayTries, setAwayTries] = useState<TryRow[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const cleanTries = (rows: TryRow[]) =>
        rows
          .filter((r) => r.scorer.trim() && r.minute.trim())
          .map((r) => ({ scorer: r.scorer.trim(), minute: Number(r.minute) }));
      await api.adminSetGameResult(token, game.id, {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        homeTries: cleanTries(homeTries),
        awayTries: cleanTries(awayTries),
      });
      setStatus("saved");
      onSaved();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-black/30 border border-white/10 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block font-bold uppercase tracking-wider">{game.homeTeam.shortName} score</span>
          <input
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            required
            inputMode="numeric"
            className="w-full bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          <span className="block font-bold uppercase tracking-wider">{game.awayTeam.shortName} score</span>
          <input
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            required
            inputMode="numeric"
            className="w-full bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </label>
      </div>

      <TrySection label={game.homeTeam.shortName} rows={homeTries} onChange={setHomeTries} />
      <TrySection label={game.awayTeam.shortName} rows={awayTries} onChange={setAwayTries} />

      <button
        disabled={status === "saving"}
        className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 text-sm transition-all duration-150 active:scale-[0.98]"
      >
        {status === "saving" ? "Saving…" : "Save result"}
      </button>
      {status === "saved" && <p className="text-emerald-400 text-sm">Result saved.</p>}
      {status === "error" && <p className="text-red-400 text-sm">{error ?? "Failed to save."}</p>}
    </form>
  );
}

export default function GameForm({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [round, setRound] = useState("");
  const [kickoffAt, setKickoffAt] = useState("");
  const [venue, setVenue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultGameId, setResultGameId] = useState<string | null>(null);

  useEffect(() => {
    api.listTeams().then(setTeams);
    refreshGames();
  }, []);

  function refreshGames() {
    api.listGames().then(setGames);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (homeTeamId && homeTeamId === awayTeamId) {
      setStatus("error");
      setError("Home and away team must be different.");
      return;
    }
    setStatus("saving");
    try {
      await api.adminCreateGame(token, {
        homeTeamId,
        awayTeamId,
        round,
        kickoffAt: new Date(kickoffAt).toISOString(),
        venue: venue || undefined,
      });
      setStatus("saved");
      setRound("");
      setKickoffAt("");
      setVenue("");
      refreshGames();
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
        <div className="grid grid-cols-2 gap-3">
          <select
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.target.value)}
            required
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">Home team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            required
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">Away team…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <input
          value={round}
          onChange={(e) => setRound(e.target.value)}
          placeholder='Round (e.g. "Round 14" or "Grand Final")'
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <input
          value={kickoffAt}
          onChange={(e) => setKickoffAt(e.target.value)}
          type="datetime-local"
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <input
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Venue (optional)"
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />

        <button
          disabled={status === "saving"}
          className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
        >
          {status === "saving" ? "Saving…" : "Create game"}
        </button>
        {status === "saved" && <p className="text-emerald-400 text-sm">Game created.</p>}
        {status === "error" && <p className="text-red-400 text-sm">{error ?? "Failed to save."}</p>}
      </form>

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">Games</h2>
        <div>
          {games.map((game) => {
            const finished = game.homeScore != null && game.awayScore != null;
            const expanded = resultGameId === game.id;
            return (
              <div key={game.id} className="border-b border-white/10 py-3 text-sm">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{game.round}</span>
                  <span>{new Date(game.kickoffAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-white font-bold">
                    {game.homeTeam.shortName} vs {game.awayTeam.shortName}
                    {finished && (
                      <span className="ml-2 text-slate-300 font-semibold">
                        {game.homeScore}–{game.awayScore}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setResultGameId(expanded ? null : game.id)}
                    className="shrink-0 text-xs font-bold text-brand-heliotrope hover:underline"
                  >
                    {finished ? "Edit result" : "Log result"}
                  </button>
                </div>
                {game.venue && <div className="text-xs text-slate-500 mt-0.5">{game.venue}</div>}
                {expanded && (
                  <ResultForm
                    token={token}
                    game={game}
                    onSaved={() => {
                      refreshGames();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
