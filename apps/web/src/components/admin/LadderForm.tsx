import { useEffect, useState } from "react";

import { api, Ladder, LadderRow } from "../../lib/api";

// The editable per-team stats — everything on LadderRow except the derived
// rank/pointsDifferential, which the backend recomputes on every read (see
// routes/ladder.ts) rather than being submitted here.
type EditableRow = {
  teamId: string;
  name: string;
  shortName: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  competitionPoints: number;
  form: string;
};

const NUMBER_FIELDS = [
  ["played", "P"],
  ["wins", "W"],
  ["losses", "L"],
  ["draws", "D"],
  ["pointsFor", "PF"],
  ["pointsAgainst", "PA"],
  ["competitionPoints", "Pts"],
] as const;

function toEditableRows(rows: LadderRow[]): EditableRow[] {
  // Edited in whatever order the admin finds easiest to scan, not
  // re-sorted by rank as they type — sort alphabetically by name once, up
  // front, so the row order stays stable across a save/reload cycle.
  return [...rows]
    .sort((a, b) => a.team.name.localeCompare(b.team.name))
    .map((row) => ({
      teamId: row.team.id,
      name: row.team.name,
      shortName: row.team.shortName,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      competitionPoints: row.competitionPoints,
      form: row.form ?? "",
    }));
}

export default function LadderForm({ token }: { token: string }) {
  const [rows, setRows] = useState<EditableRow[] | null>(null);
  const [asOfRound, setAsOfRound] = useState("");
  const [roundInProgress, setRoundInProgress] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getLadder().then((ladder: Ladder) => {
      setRows(toEditableRows(ladder.rows));
      setAsOfRound(ladder.asOfRound ? String(ladder.asOfRound) : "");
      setRoundInProgress(ladder.roundInProgress);
    });
  }, []);

  function updateField(teamId: string, field: (typeof NUMBER_FIELDS)[number][0], value: string) {
    const parsed = Math.max(0, Number(value) || 0);
    setRows((prev) => prev?.map((row) => (row.teamId === teamId ? { ...row, [field]: parsed } : row)) ?? prev);
  }

  function updateForm(teamId: string, value: string) {
    // Only W/L/D, uppercased, capped at 5 — oldest-to-newest per game.
    const cleaned = value.toUpperCase().replace(/[^WLD]/g, "").slice(0, 5);
    setRows((prev) => prev?.map((row) => (row.teamId === teamId ? { ...row, form: cleaned } : row)) ?? prev);
  }

  async function handleSave() {
    if (!rows) return;
    const roundNumber = Number(asOfRound);
    if (!roundNumber || roundNumber < 1) {
      setStatus("error");
      setError("Enter which round these standings are after.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      await api.adminUpdateLadder(token, {
        asOfRound: roundNumber,
        roundInProgress,
        rows: rows.map(({ name, shortName, ...row }) => row),
      });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  if (!rows) return <p className="text-slate-500 text-sm">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Re-enter every team's stats after each round, then save — this replaces the whole table in one go. Rank and
        points differential are calculated automatically.
      </p>
      <div>
        <label className="text-xs text-slate-500 block mb-1">
          After round # (byes mean this isn't always the same as everyone's "played" count)
        </label>
        <input
          type="number"
          min={1}
          value={asOfRound}
          onChange={(e) => setAsOfRound(e.target.value)}
          placeholder="e.g. 25"
          className="w-24 bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={roundInProgress}
          onChange={(e) => setRoundInProgress(e.target.checked)}
          className="accent-brand-violet"
        />
        Round still in progress (shows "Round N · in progress" instead of "After Round N")
      </label>
      <div className="overflow-x-auto rounded-xl bg-surface border border-white/10 shadow-card">
        <table className="w-full text-sm text-right">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-white/10">
              <th className="text-left px-3 py-2">Team</th>
              {NUMBER_FIELDS.map(([field, label]) => (
                <th key={field} className="px-1 py-2 w-16">
                  {label}
                </th>
              ))}
              <th className="px-1 py-2 w-20">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId} className="border-b border-white/5 last:border-0">
                <td className="text-left px-3 py-2 font-bold text-white whitespace-nowrap">{row.shortName}</td>
                {NUMBER_FIELDS.map(([field]) => (
                  <td key={field} className="px-1 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={row[field]}
                      onChange={(e) => updateField(row.teamId, field, e.target.value)}
                      className="w-14 bg-black border border-white/20 px-1.5 py-1 text-right text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
                    />
                  </td>
                ))}
                <td className="px-1 py-1.5">
                  <input
                    type="text"
                    value={row.form}
                    onChange={(e) => updateForm(row.teamId, e.target.value)}
                    placeholder="WWLWW"
                    className="w-20 bg-black border border-white/20 px-1.5 py-1 text-right text-white tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
      >
        {status === "saving" ? "Saving…" : "Save ladder"}
      </button>
      {status === "saved" && <p className="text-emerald-400 text-sm">Ladder updated.</p>}
      {status === "error" && <p className="text-red-400 text-sm">{error ?? "Failed to save."}</p>}
    </div>
  );
}
