import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, LadderRow } from "../lib/api";
import TeamBadge from "../components/TeamBadge";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// Must match exactly between the column header and every row — see the
// design handoff's Ladder section: "# TEAM P W L D F A DIFF PTS".
const GRID_COLS = "30px 1fr 24px 24px 24px 22px 34px 34px 38px 32px";
const FINALS_CUTOFF_RANK = 8;

export default function LadderPage() {
  const [rows, setRows] = useState<LadderRow[] | null>(null);
  const [asOfRound, setAsOfRound] = useState<number | null>(null);
  const [roundInProgress, setRoundInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL Ladder",
    description: "Full NRL ladder standings — points, wins, losses, points diff, and finals cutoff, updated every round.",
    path: "/ladder",
  });

  useEffect(() => {
    api
      .getLadder()
      .then((ladder) => {
        setRows(ladder.rows);
        setAsOfRound(ladder.asOfRound);
        setRoundInProgress(ladder.roundInProgress);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="bg-gradient-to-b from-[#141B33] to-app px-5 pt-4 pb-3.5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="font-display italic font-black text-[28px] tracking-[.01em] text-white uppercase">LADDER</h1>
          <span className="flex items-center gap-1.5 bg-white/[.06] border border-white/[.12] rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white/72">
            {new Date().getFullYear()} NRL Premiership
          </span>
        </div>
        <div className="max-w-3xl mx-auto flex items-center gap-2.5 mt-2">
          {asOfRound !== null && (
            <>
              <span className="text-xs font-semibold text-white/42">
                {roundInProgress ? `Round ${asOfRound} · in progress` : `After Round ${asOfRound}`} ·{" "}
                {rows?.length ?? 0} teams
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-white/22" />
            </>
          )}
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-violet">
            <span className="w-[9px] h-[3px] rounded-sm bg-brand-violet" />
            Finals spots
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {error && <p className="text-red-400 text-sm p-4">{error}</p>}

        {!rows && !error && (
          <div className="px-4">
            {Array.from({ length: 17 }).map((_, i) => (
              <div key={i} className="h-10 bg-surface rounded-[14px] my-1.5 animate-pulse" />
            ))}
          </div>
        )}

        {rows && (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="min-w-[380px]">
              <div
                className="grid items-center gap-0 px-4 py-[9px] bg-surface-alt border-y border-white/[.07] font-display font-bold text-[11px] tracking-[.1em] text-white/40"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <span>#</span>
                <span>TEAM</span>
                <span className="text-center">P</span>
                <span className="text-center">W</span>
                <span className="text-center">L</span>
                <span className="text-center">D</span>
                <span className="text-right">F</span>
                <span className="text-right">A</span>
                <span className="text-right">DIFF</span>
                <span className="text-right">PTS</span>
              </div>

              {rows.map((row) => {
                const top8 = row.rank <= FINALS_CUTOFF_RANK;
                return (
                  <div key={row.team.id}>
                    <Link
                      to={`/teams/${row.team.slug}`}
                      className="grid items-center px-4 py-2.5 border-b border-white/5"
                      style={{
                        gridTemplateColumns: GRID_COLS,
                        background: top8 ? "rgba(139,77,255,.07)" : "transparent",
                        boxShadow: top8 ? "inset 3px 0 0 #8B4DFF" : "none",
                      }}
                    >
                      <span className="flex items-center gap-[3px]">
                        <span className={`font-display font-bold text-sm ${top8 ? "text-brand-violet" : "text-white/38"}`}>
                          {row.rank}
                        </span>
                        {/* Typographic, not coloured — same "no status colour" rule as W/L elsewhere. */}
                        {row.movement === "up" && <span className="text-white/40 text-[9px] leading-none">▲</span>}
                        {row.movement === "down" && <span className="text-white/40 text-[9px] leading-none">▼</span>}
                      </span>
                      <span className="flex items-center gap-2 min-w-0">
                        <TeamBadge team={row.team} size="sm" />
                        <span className="text-[13px] font-bold tracking-[-.01em] text-white truncate">
                          {row.team.shortName}
                        </span>
                      </span>
                      <span className="text-center text-[11.5px] font-semibold tabular-nums text-white/55">{row.played}</span>
                      <span className="text-center text-[11.5px] font-semibold tabular-nums text-white/55">{row.wins}</span>
                      <span className="text-center text-[11.5px] font-semibold tabular-nums text-white/55">{row.losses}</span>
                      <span className="text-center text-[11.5px] font-semibold tabular-nums text-white/55">{row.draws}</span>
                      <span className="text-right text-[11.5px] font-semibold tabular-nums text-white/45">{row.pointsFor}</span>
                      <span className="text-right text-[11.5px] font-semibold tabular-nums text-white/45">{row.pointsAgainst}</span>
                      <span
                        className={`text-right text-[11.5px] font-bold tabular-nums ${
                          row.pointsDifferential > 0 ? "text-white/80" : "text-white/40"
                        }`}
                      >
                        {row.pointsDifferential > 0 ? `+${row.pointsDifferential}` : row.pointsDifferential}
                      </span>
                      <span className="text-right font-display font-bold text-base tabular-nums text-white">
                        {row.competitionPoints}
                      </span>
                    </Link>
                    {row.rank === FINALS_CUTOFF_RANK && (
                      <div className="flex items-center gap-[9px] px-4 py-[7px] bg-app">
                        <span className="flex-1 h-px bg-gradient-to-r from-brand-violet/55 to-transparent" />
                        <span className="font-display font-bold text-[10px] tracking-[.16em] text-white/42 whitespace-nowrap">
                          FINALS CUT-OFF
                        </span>
                        <span className="flex-1 h-px bg-gradient-to-l from-brand-violet/55 to-transparent" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {rows && (
          <p className="text-[11px] leading-relaxed font-medium text-white/34 mx-4 my-5">
            Points: 2 per win, 1 per draw. Ties split on points differential.
          </p>
        )}
      </div>
    </div>
  );
}
