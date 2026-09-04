import { useEffect, useState } from "react";

import { api, JudiciaryCharge } from "../lib/api";
import { RowListSkeleton } from "../components/ui/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useDocumentMeta } from "../lib/useDocumentMeta";

const ChevronLeft = () => (
  <svg width="7" height="11" viewBox="0 0 7 11" fill="none" className="shrink-0">
    <path d="M6 1L1.5 5.5L6 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ChevronRight = () => (
  <svg width="7" height="11" viewBox="0 0 7 11" fill="none" className="shrink-0">
    <path d="M1 1L5.5 5.5L1 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function formatPenalty(charge: JudiciaryCharge): string {
  const parts: string[] = [];
  if (charge.matchesToServe) parts.push(`${charge.matchesToServe} match${charge.matchesToServe === 1 ? "" : "es"}`);
  if (charge.financialPenalty) parts.push(`$${charge.financialPenalty.toLocaleString()}`);
  return parts.length > 0 ? parts.join(" + ") : "—";
}

// Round navigation mirrors GamesPage: defaults to the most recent round with
// any charges (GET /api/judiciary with no ?round=), then steps through
// GET /api/judiciary/rounds — insertion order there, not a fixture-derived
// chronology, since a charge has no kickoff time to sort by.
export default function JudiciaryPage() {
  const [rounds, setRounds] = useState<string[] | null>(null);
  const [round, setRound] = useState<string | null>(null);
  const [charges, setCharges] = useState<JudiciaryCharge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "Judiciary",
    description: "NRL Match Review Committee outcomes — charges, grades, suspensions and fines, round by round.",
    path: "/judiciary",
  });

  useEffect(() => {
    Promise.all([api.listJudiciary(), api.listJudiciaryRounds()])
      .then(([current, allRounds]) => {
        setRound(current[0]?.round ?? allRounds[allRounds.length - 1] ?? null);
        setCharges(current);
        setRounds(allRounds);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!round) return;
    api.listJudiciary(round).then(setCharges).catch((err) => setError(err.message));
  }, [round]);

  const roundIndex = rounds && round ? rounds.indexOf(round) : -1;
  const hasPrev = roundIndex > 0;
  const hasNext = rounds !== null && roundIndex >= 0 && roundIndex < rounds.length - 1;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Judiciary</h1>

      {rounds && rounds.length > 0 && round && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface border border-white/10 px-2 py-2">
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => hasPrev && setRound(rounds[roundIndex - 1])}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            aria-label="Previous round"
          >
            <ChevronLeft />
          </button>
          <span className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider">{round}</span>
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => hasNext && setRound(rounds[roundIndex + 1])}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors duration-150"
            aria-label="Next round"
          >
            <ChevronRight />
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!charges && !error && <RowListSkeleton count={5} />}
      {charges && charges.length === 0 && (
        <p className="text-slate-500 text-sm">
          {round ? `No charges laid for ${round}.` : "No judiciary reports yet."}
        </p>
      )}

      {charges && charges.length > 0 && (
        <div className="space-y-2">
          {charges.map((c) => (
            <div key={c.id} className="rounded-xl bg-surface border border-white/10 shadow-card p-3">
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
          ))}
        </div>
      )}
    </div>
  );
}
