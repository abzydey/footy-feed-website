import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, Player, Team } from "../../lib/api";

interface ParsedPlayer {
  name: string;
  position?: string;
  jerseyNumber?: number;
}

// One player per line: "<jersey #> <name>, <position>" — jersey number and
// position are both optional. Handles a leading "1." or "1 " for the
// jersey number, and works with just a name if that's all that's pasted.
// Examples that all parse correctly:
//   1. Reece Walsh, Fullback
//   2 Selwyn Cobbo, Wing
//   Herbie Farnworth, Centre
const SQUAD_LINE = /^\s*(?:(\d+)\.?\s+)?([^,]+?)\s*(?:,\s*(.+))?\s*$/;

function parseSquadText(text: string): ParsedPlayer[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(SQUAD_LINE);
      if (!match || !match[2]) return [];
      const [, jersey, name, position] = match;
      return [
        {
          name: name.trim(),
          position: position?.trim() || undefined,
          jerseyNumber: jersey ? Number(jersey) : undefined,
        },
      ];
    });
}

export default function PlayerForm({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamSlug, setTeamSlug] = useState("");
  const [roster, setRoster] = useState<Player[]>([]);

  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const parsedBulk = useMemo(() => parseSquadText(bulkText), [bulkText]);

  useEffect(() => {
    api.listTeams().then(setTeams);
  }, []);

  useEffect(() => {
    if (!teamSlug) {
      setRoster([]);
      return;
    }
    refreshRoster();
  }, [teamSlug]);

  function refreshRoster() {
    if (!teamSlug) return;
    api.getTeamBrief(teamSlug).then((data) => setRoster(data.players));
  }

  const selectedTeam = teams.find((t) => t.slug === teamSlug);

  async function handleDelete(id: string) {
    await api.adminDeletePlayer(token, id);
    refreshRoster();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedTeam) return;
    setStatus("saving");
    try {
      await api.adminCreatePlayer(token, {
        teamId: selectedTeam.id,
        name,
        position: position || undefined,
        jerseyNumber: jerseyNumber ? Number(jerseyNumber) : undefined,
      });
      setStatus("saved");
      setName("");
      setPosition("");
      setJerseyNumber("");
      refreshRoster();
    } catch (err) {
      setStatus("error");
    }
  }

  async function handleBulkSubmit() {
    if (!selectedTeam || parsedBulk.length === 0) return;
    setBulkStatus("saving");
    setBulkMessage(null);
    try {
      const result = await api.adminBulkCreatePlayers(token, { teamId: selectedTeam.id, players: parsedBulk });
      setBulkStatus("saved");
      setBulkMessage(`Added ${result.created} player${result.created === 1 ? "" : "s"}.`);
      setBulkText("");
      refreshRoster();
    } catch (err) {
      setBulkStatus("error");
      setBulkMessage(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-surface border border-white/10 shadow-card p-4"
      >
        <select
          value={teamSlug}
          onChange={(e) => setTeamSlug(e.target.value)}
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        >
          <option value="">Select team…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder='Position (e.g. "Fullback")'
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
          <input
            value={jerseyNumber}
            onChange={(e) => setJerseyNumber(e.target.value)}
            type="number"
            min={1}
            placeholder="Jersey #"
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </div>

        <button
          disabled={status === "saving" || !teamSlug}
          className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
        >
          {status === "saving" ? "Adding…" : "Add player"}
        </button>
        {status === "saved" && <p className="text-emerald-400 text-sm">Player added.</p>}
        {status === "error" && <p className="text-brand-siren text-sm">Failed to save.</p>}
      </form>

      <div className="space-y-3 rounded-xl bg-surface border border-white/10 shadow-card p-4">
        <div>
          <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-1">Bulk add</h2>
          <p className="text-xs text-slate-500">
            Paste a full squad, one player per line: <code className="text-slate-400">jersey # · name, position</code> — e.g.{" "}
            <code className="text-slate-400">1. Reece Walsh, Fullback</code>. Jersey number and position are both
            optional; uses the team selected above.
          </p>
        </div>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"1. Reece Walsh, Fullback\n2. Selwyn Cobbo, Wing\n3. Herbie Farnworth, Centre\n..."}
          rows={8}
          className="w-full bg-black border border-white/20 px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {parsedBulk.length > 0
              ? `${parsedBulk.length} player${parsedBulk.length === 1 ? "" : "s"} recognized`
              : "No players recognized yet"}
          </span>
          <button
            onClick={handleBulkSubmit}
            disabled={!teamSlug || parsedBulk.length === 0 || bulkStatus === "saving"}
            className="shrink-0 bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-40 text-white font-bold px-4 py-2 text-sm transition-all duration-150 active:scale-[0.98]"
          >
            {bulkStatus === "saving" ? "Adding…" : `Add ${parsedBulk.length || ""} player${parsedBulk.length === 1 ? "" : "s"}`}
          </button>
        </div>
        {bulkStatus === "saved" && <p className="text-emerald-400 text-sm">{bulkMessage}</p>}
        {bulkStatus === "error" && <p className="text-brand-siren text-sm">{bulkMessage}</p>}
      </div>

      {teamSlug && (
        <section>
          <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">
            {selectedTeam?.name} roster ({roster.length})
          </h2>
          <div>
            {roster.length === 0 && <p className="text-slate-500 text-sm">No players yet.</p>}
            {roster.map((player) => (
              <div key={player.id} className="border-b border-white/10 py-3 text-sm flex items-center justify-between gap-3">
                <div>
                  <span className="text-white font-bold">{player.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {[player.jerseyNumber ? `#${player.jerseyNumber}` : null, player.position].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(player.id)}
                  className="text-xs text-slate-500 hover:text-brand-siren transition-colors duration-150 shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
