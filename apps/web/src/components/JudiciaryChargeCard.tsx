import { JudiciaryCharge } from "../lib/api";
import TeamBadge from "./TeamBadge";

function formatPenalty(charge: JudiciaryCharge): string {
  const parts: string[] = [];
  if (charge.matchesToServe) parts.push(`${charge.matchesToServe} match${charge.matchesToServe === 1 ? "" : "es"}`);
  if (charge.financialPenalty) parts.push(`$${charge.financialPenalty.toLocaleString()}`);
  return parts.length > 0 ? parts.join(" + ") : "—";
}

// Shared between JudiciaryPage's own round view and Home's "Judiciary" feed
// filter, so the two never drift apart in what a charge card looks like.
export default function JudiciaryChargeCard({ charge: c }: { charge: JudiciaryCharge }) {
  return (
    <div className="rounded-xl bg-surface border border-white/10 shadow-card p-3">
      <div className="flex items-center gap-2.5">
        <TeamBadge team={c.team} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-sm text-white truncate">{c.player}</div>
          <div className="text-[11px] text-slate-500">{c.team.shortName}</div>
        </div>
        <span className="shrink-0 text-[11px] font-bold text-brand-heliotrope uppercase tracking-wider">
          {c.grade}
        </span>
      </div>
      <p className="text-sm text-slate-300 mt-2">{c.charge}</p>
      <div className="flex items-center justify-between gap-2 mt-2 text-xs">
        <span className="text-slate-400">{c.result}</span>
        <span className="font-bold text-white">{formatPenalty(c)}</span>
      </div>
    </div>
  );
}
