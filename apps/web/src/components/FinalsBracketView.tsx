import { Bracket, MatchSlot, SLOT_LABEL, SlotId, winnerOf } from "../lib/finalsBracket";
import { teamAbbreviation } from "../lib/teamBadge";
import TeamBadge from "./TeamBadge";

const WEEKS: { title: string; slots: SlotId[] }[] = [
  { title: "Week 1 — Qualifying & Elimination Finals", slots: ["QF1", "QF2", "EF1", "EF2"] },
  { title: "Week 2 — Semi Finals", slots: ["SF1", "SF2"] },
  { title: "Week 3 — Preliminary Finals", slots: ["PF1", "PF2"] },
  { title: "Week 4 — Grand Final", slots: ["GF"] },
];

function seedOf(slot: MatchSlot, side: "home" | "away", top8Ranks: Map<string, number>): number | null {
  const team = slot[side];
  return team ? (top8Ranks.get(team.id) ?? null) : null;
}

function TeamRow({
  team,
  seed,
  score,
  isWinner,
  isDecided,
}: {
  team: { slug: string; shortName: string; primaryColor: string | null } | null;
  seed: number | null;
  score: number | null;
  isWinner: boolean;
  isDecided: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-[5px] ${isDecided && !isWinner ? "opacity-45" : ""}`}>
      <div className="flex items-center gap-2 min-w-0">
        {seed != null && <span className="w-4 shrink-0 text-[11px] font-bold text-white/35 tabular-nums">{seed}</span>}
        {team ? (
          <>
            <TeamBadge team={team} size="sm" />
            <span className="text-[13.5px] font-extrabold text-white truncate">{teamAbbreviation(team)}</span>
          </>
        ) : (
          <>
            <div className="w-8 h-8 shrink-0 rounded-full bg-white/[.05] border border-white/10" />
            <span className="text-[13px] font-semibold text-white/35">TBD</span>
          </>
        )}
      </div>
      {score != null && (
        <span className={`text-[13.5px] tabular-nums shrink-0 ${isWinner ? "font-extrabold text-white" : "font-bold"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

// Reuses NextGameCard's compact two-row team layout (badge + code, score on
// the right) rather than GamesPage's single-line "Team vs Team" — a bracket
// needs several of these stacked at once, so the taller single-line version
// would push everything below the fold fast. Winner state is plain
// bold/dim, never colour-coded — Siren is reserved for the live indicator
// only, per the brief.
function MatchSlotCard({ slot, top8Ranks }: { slot: MatchSlot; top8Ranks: Map<string, number> }) {
  const winner = winnerOf(slot);
  const isDecided = winner != null;
  const isLive = slot.game?.status === "LIVE";

  return (
    <div className="rounded-xl bg-surface border border-white/10 shadow-card px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-bold text-white/40 uppercase tracking-wider">{SLOT_LABEL[slot.id]}</span>
        {isLive && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-siren animate-pulse">
            ● Live{slot.game?.liveClock ? ` ${slot.game.liveClock}` : ""}
          </span>
        )}
      </div>
      <TeamRow
        team={slot.home}
        seed={seedOf(slot, "home", top8Ranks)}
        score={slot.game?.status === "SCHEDULED" ? null : (slot.game?.homeScore ?? null)}
        isWinner={winner != null && slot.home != null && winner.id === slot.home.id}
        isDecided={isDecided}
      />
      <TeamRow
        team={slot.away}
        seed={seedOf(slot, "away", top8Ranks)}
        score={slot.game?.status === "SCHEDULED" ? null : (slot.game?.awayScore ?? null)}
        isWinner={winner != null && slot.away != null && winner.id === slot.away.id}
        isDecided={isDecided}
      />
    </div>
  );
}

export default function FinalsBracketView({ bracket, top8Ranks }: { bracket: Bracket; top8Ranks: Map<string, number> }) {
  return (
    <div className="space-y-5">
      {WEEKS.map((week) => (
        <div key={week.title}>
          <h3 className="font-display font-bold text-[12px] tracking-[.08em] text-brand-heliotrope uppercase mb-2">
            {week.title}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {week.slots.map((id) => (
              <MatchSlotCard key={id} slot={bracket.slots[id]} top8Ranks={top8Ranks} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
