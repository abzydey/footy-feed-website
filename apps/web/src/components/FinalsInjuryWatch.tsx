import { FinalsInjuryEntry, FinalsInjuryStatus } from "../lib/api";
import { TeamRef } from "../lib/finalsBracket";
import TeamBadge from "./TeamBadge";

// No green/red anywhere, per the brief — OUT reuses Siren (the one warm
// accent, already reserved elsewhere for "this matters right now"), LIKELY
// leans on the brand violet as the one positive-leaning signal, and the
// remaining three genuinely-uncertain states share a plain muted tone
// rather than inventing three more distinct colours for "we don't know yet"
// in three slightly different ways.
const STATUS_COLOR: Record<FinalsInjuryStatus, string> = {
  OUT: "text-brand-siren",
  LIKELY: "text-brand-violet",
  UNLIKELY: "text-white/55",
  TBA: "text-white/35",
  TBC: "text-white/35",
};

const STATUS_LABEL: Record<FinalsInjuryStatus, string> = {
  OUT: "Out",
  LIKELY: "Likely",
  UNLIKELY: "Unlikely",
  TBA: "TBA",
  TBC: "TBC",
};

// Grouped by team, teams still alive in the bracket only — a team eliminated
// last week has nothing useful to say here anymore, distinct from the
// ongoing/general per-team injury list already live on team pages (see
// schema.prisma design note on FinalsInjuryEntry).
export default function FinalsInjuryWatch({
  entries,
  aliveTeams,
}: {
  entries: FinalsInjuryEntry[];
  aliveTeams: TeamRef[];
}) {
  const grouped = aliveTeams
    .map((team) => ({ team, rows: entries.filter((e) => e.team.id === team.id) }))
    .filter((g) => g.rows.length > 0);

  if (grouped.length === 0) {
    return <p className="text-[13.5px] font-semibold text-white/50 text-center py-4">No finals injury news yet.</p>;
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ team, rows }) => (
        <div key={team.id} className="rounded-xl bg-surface border border-white/10 shadow-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <TeamBadge team={team} size="sm" />
            <span className="font-display font-bold text-sm text-white">{team.shortName}</span>
          </div>
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[13px] font-bold text-white">{r.player}</span>
                  <span className="text-[12px] text-slate-500"> — {r.injury}</span>
                </div>
                <span className={`shrink-0 text-[11px] font-extrabold uppercase tracking-wider ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
