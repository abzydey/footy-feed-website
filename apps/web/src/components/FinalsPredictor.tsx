import { useEffect, useState } from "react";

import { Bracket, buildPredictedBracket, SLOT_LABEL, SlotId, TeamRef, winnerOf } from "../lib/finalsBracket";
import { LadderRow } from "../lib/api";
import { teamAbbreviation } from "../lib/teamBadge";
import TeamBadge from "./TeamBadge";

const SLOT_ORDER: SlotId[] = ["QF1", "QF2", "EF1", "EF2", "SF1", "SF2", "PF1", "PF2", "GF"];

// Versioned by season so a leftover pick set from a prior finals series never
// resurfaces against a new one — client-side storage only for v1, per the
// brief (no accounts/backend needed; revisit persistence if there's demand).
const STORAGE_KEY = "finals-predictor-picks-2026";

function loadPicks(): Partial<Record<SlotId, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePicks(picks: Partial<Record<SlotId, string>>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    // storage unavailable (private browsing, quota) — the predictor still
    // works for the session, it just won't persist across reloads.
  }
}

function PickableTeamRow({
  team,
  isPick,
  isActual,
  correctness,
  disabled,
  onPick,
}: {
  team: TeamRef | null;
  isPick: boolean;
  isActual: "winner" | "loser" | null;
  correctness: "correct" | "wrong" | null;
  disabled: boolean;
  onPick: () => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 py-[5px] opacity-40">
        <div className="w-8 h-8 shrink-0 rounded-full bg-white/[.05] border border-white/10" />
        <span className="text-[13px] font-semibold text-white/35">TBD</span>
      </div>
    );
  }

  const textClass =
    correctness === "correct"
      ? "text-brand-violet"
      : correctness === "wrong"
        ? "text-white/40"
        : isActual === "loser"
          ? "text-white/40"
          : "text-white";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={`flex items-center justify-between gap-2 w-full py-[5px] rounded-lg px-1.5 -mx-1.5 transition-colors duration-150 ${
        disabled ? "" : "hover:bg-white/[.04] active:scale-[0.99]"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <TeamBadge team={team} size="sm" />
        <span className={`text-[13.5px] font-extrabold truncate ${textClass}`}>{teamAbbreviation(team)}</span>
      </div>
      {isPick && !isActual && <span className="shrink-0 text-[10px] font-bold text-brand-violet uppercase tracking-wider">Pick</span>}
      {correctness === "correct" && <span className="shrink-0 text-[10px] font-bold text-brand-violet uppercase tracking-wider">✓ Correct</span>}
    </button>
  );
}

// Classic cascading bracket predictor: pick a winner, that pick flows
// straight into whichever slot they'd occupy next round (see
// buildPredictedBracket). Once a real result lands for a slot, it locks —
// no re-picking a match that's already been played — and shows the pick's
// correctness in Purple (right) or muted grey (wrong), never green/red.
export default function FinalsPredictor({ top8, realBracket }: { top8: LadderRow[]; realBracket: Bracket }) {
  const [picks, setPicks] = useState<Partial<Record<SlotId, string>>>({});

  useEffect(() => {
    setPicks(loadPicks());
  }, []);

  const predicted = buildPredictedBracket(top8, picks);

  function pick(slotId: SlotId, teamId: string) {
    const next = { ...picks, [slotId]: teamId };
    setPicks(next);
    savePicks(next);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {SLOT_ORDER.map((id) => {
        const realSlot = realBracket.slots[id];
        const realWinner = winnerOf(realSlot);
        const isDecided = realWinner != null;
        const slot = predicted[id];
        const userPickId = picks[id];

        return (
          <div key={id} className="rounded-xl bg-surface border border-white/10 shadow-card px-3 py-2.5">
            <div className="text-[10.5px] font-bold text-white/40 uppercase tracking-wider mb-1">{SLOT_LABEL[id]}</div>
            {(["home", "away"] as const).map((side) => {
              const team = slot[side];
              const isPick = !!team && userPickId === team.id;
              const isActual = isDecided && team ? (realWinner!.id === team.id ? "winner" : "loser") : null;
              const correctness = isDecided && isPick ? (isActual === "winner" ? "correct" : "wrong") : null;
              return (
                <PickableTeamRow
                  key={side}
                  team={team}
                  isPick={isPick}
                  isActual={isActual}
                  correctness={correctness}
                  disabled={isDecided || !team}
                  onPick={() => team && pick(id, team.id)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
