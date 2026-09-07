import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, FinalsInjuryEntry, Game, LadderRow } from "../lib/api";
import { buildFinalsBracket, teamsAliveInFinals, winnerOf, FINALS_ROUNDS } from "../lib/finalsBracket";
import TeamBadge from "./TeamBadge";

const ChevronRight = () => (
  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="shrink-0">
    <path d="M1 4.5h8M6 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MAX_PREVIEW = 4;

// Same card shell as WhatsBeenSaidTeaser/LatestEpisodeTeaser — a summarized
// preview + deep link into a page section, not a second copy of the data.
// This reads straight from the same finals-injuries endpoint /finals itself
// uses (no new pipeline), just narrowed to a handful of standout ("Out")
// entries across teams still alive, and only shown while finals are
// actually on: once there's no finals game entered yet, or the Grand Final
// has already been decided, this renders nothing rather than showing stale
// or premature finals content on Home year-round.
export default function FinalsInjuryHomeCard() {
  const [ladderRows, setLadderRows] = useState<LadderRow[] | null>(null);
  const [games, setGames] = useState<Game[] | null>(null);
  const [injuries, setInjuries] = useState<FinalsInjuryEntry[] | null>(null);

  useEffect(() => {
    api
      .getLadder()
      .then((l) => setLadderRows(l.rows))
      .catch(() => setLadderRows([]));
    Promise.all(FINALS_ROUNDS.map((round) => api.listGames(round)))
      .then((results) => setGames(results.flat()))
      .catch(() => setGames([]));
    api.listFinalsInjuries().then(setInjuries).catch(() => setInjuries([]));
  }, []);

  if (!ladderRows || !games || !injuries) return null;

  const top8 = ladderRows.filter((r) => r.rank <= 8).sort((a, b) => a.rank - b.rank);
  const hasFinalsStarted = games.some((g) => FINALS_ROUNDS.includes(g.round));
  if (!hasFinalsStarted) return null;

  const bracket = buildFinalsBracket(top8, games);
  const grandFinalDecided = winnerOf(bracket.slots.GF) != null;
  if (grandFinalDecided) return null;

  const aliveIds = new Set(teamsAliveInFinals(top8, games).map((t) => t.id));
  const relevant = injuries.filter((e) => aliveIds.has(e.team.id));
  if (relevant.length === 0) return null;

  // "Out" entries are the standout ones — a confirmed absence matters more
  // to a skimming reader than "TBC"/"Likely" — with the rest filling in
  // only if there aren't enough Outs to make a worthwhile preview.
  const outs = relevant.filter((e) => e.status === "OUT");
  const rest = relevant.filter((e) => e.status !== "OUT");
  const preview = [...outs, ...rest].slice(0, MAX_PREVIEW);

  return (
    <Link
      to="/finals#injury-watch"
      className="block bg-surface border border-white/[.07] rounded-[14px] px-[15px] pt-[15px] pb-[13px] hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="flex items-center gap-2 mb-[9px]">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
          Finals Injury Watch
        </span>
      </div>

      <div className="space-y-2">
        {preview.map((e) => (
          <div key={e.id} className="flex items-center gap-2.5">
            <TeamBadge team={e.team} size="sm" />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-bold text-white">{e.player}</span>
              <span className="text-[11.5px] text-slate-500"> — {e.injury}</span>
            </div>
            <span
              className={`shrink-0 text-[10.5px] font-extrabold uppercase tracking-wider ${
                e.status === "OUT" ? "text-brand-siren" : e.status === "LIKELY" ? "text-brand-violet" : "text-white/35"
              }`}
            >
              {e.status === "OUT" ? "Out" : e.status === "LIKELY" ? "Likely" : e.status === "UNLIKELY" ? "Unlikely" : e.status}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/[.06]">
        <span className="text-[11.5px] font-semibold text-white/46">See full injury watch</span>
        <span className="shrink-0 flex items-center gap-[5px] text-xs font-extrabold tracking-[.02em] text-brand-violet">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}
