import { useEffect, useState } from "react";

import { api, JudiciaryCharge, Team } from "../../lib/api";

interface ChargeRow {
  player: string;
  teamId: string;
  charge: string;
  grade: string;
  result: string;
  matchesToServe: string;
  financialPenalty: string;
}

const emptyRow: ChargeRow = { player: "", teamId: "", charge: "", grade: "", result: "", matchesToServe: "", financialPenalty: "" };

function toRows(charges: JudiciaryCharge[]): ChargeRow[] {
  return charges.map((c) => ({
    player: c.player,
    teamId: c.team.id,
    charge: c.charge,
    grade: c.grade,
    result: c.result,
    matchesToServe: c.matchesToServe != null ? String(c.matchesToServe) : "",
    financialPenalty: c.financialPenalty != null ? String(c.financialPenalty) : "",
  }));
}

// Whole-round replace, same shape as LadderForm: the admin pastes/re-enters
// every charge from that week's Judiciary Report and saves once, rather
// than editing charges one at a time — matches POST /api/admin/judiciary,
// which deletes and recreates the named round's rows in one transaction.
export default function JudiciaryForm({ token }: { token: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [round, setRound] = useState("");
  const [rows, setRows] = useState<ChargeRow[]>([{ ...emptyRow }]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTeams().then(setTeams);
  }, []);

  async function loadRound() {
    if (!round.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const charges = await api.listJudiciary(round.trim());
      setRows(charges.length > 0 ? toRows(charges) : [{ ...emptyRow }]);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to load.");
    }
  }

  function updateRow(i: number, field: keyof ChargeRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!round.trim()) {
      setStatus("error");
      setError("Enter which round this report is for.");
      return;
    }
    const cleaned = rows
      .filter((r) => r.player.trim() && r.teamId && r.charge.trim() && r.grade.trim() && r.result.trim())
      .map((r) => ({
        player: r.player.trim(),
        teamId: r.teamId,
        charge: r.charge.trim(),
        grade: r.grade.trim(),
        result: r.result.trim(),
        matchesToServe: r.matchesToServe.trim() ? Number(r.matchesToServe) : undefined,
        financialPenalty: r.financialPenalty.trim() ? Number(r.financialPenalty) : undefined,
      }));
    setStatus("saving");
    setError(null);
    try {
      await api.adminSetJudiciary(token, { round: round.trim(), charges: cleaned });
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Enter (or re-enter) every charge from that round's Judiciary Report, then save — this replaces the whole
        round's charges in one go. Leave a charge's Player/Grade/Result blank to drop it when saving.
      </p>
      <div className="flex items-end gap-2">
        <label className="text-xs text-slate-500 space-y-1 flex-1">
          <span className="block">Round (e.g. "Round 27")</span>
          <input
            value={round}
            onChange={(e) => setRound(e.target.value)}
            placeholder="Round 27"
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </label>
        <button
          type="button"
          onClick={loadRound}
          disabled={status === "loading"}
          className="shrink-0 bg-surface border border-white/20 hover:border-white/40 disabled:opacity-60 text-white text-sm font-bold px-3 py-2 transition-colors duration-150"
        >
          {status === "loading" ? "Loading…" : "Load existing"}
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl bg-surface border border-white/10 shadow-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Charge {i + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-slate-500 hover:text-brand-siren text-xs transition-colors duration-150"
                aria-label="Remove charge"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={row.player}
                onChange={(e) => updateRow(i, "player", e.target.value)}
                placeholder="Player"
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              />
              <select
                value={row.teamId}
                onChange={(e) => updateRow(i, "teamId", e.target.value)}
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              >
                <option value="">Club…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={row.charge}
              onChange={(e) => updateRow(i, "charge", e.target.value)}
              placeholder="Charge / incident (e.g. Grade 1 Careless High Tackle)"
              className="w-full bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={row.grade}
                onChange={(e) => updateRow(i, "grade", e.target.value)}
                placeholder="Grade (e.g. Grade 1)"
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              />
              <input
                value={row.result}
                onChange={(e) => updateRow(i, "result", e.target.value)}
                placeholder="Result (e.g. Guilty - Early Guilty Plea)"
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={row.matchesToServe}
                onChange={(e) => updateRow(i, "matchesToServe", e.target.value)}
                placeholder="Matches to serve"
                inputMode="numeric"
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              />
              <input
                value={row.financialPenalty}
                onChange={(e) => updateRow(i, "financialPenalty", e.target.value)}
                placeholder="Fine ($, optional)"
                inputMode="numeric"
                className="bg-black border border-white/20 px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
        className="text-xs font-bold text-brand-heliotrope hover:underline"
      >
        + Add charge
      </button>

      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
      >
        {status === "saving" ? "Saving…" : "Save judiciary report"}
      </button>
      {status === "saved" && <p className="text-emerald-400 text-sm">Judiciary report saved.</p>}
      {status === "error" && <p className="text-brand-siren text-sm">{error ?? "Failed to save."}</p>}
    </div>
  );
}
