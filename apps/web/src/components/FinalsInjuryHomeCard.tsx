import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, FinalsInjuryEntry, Game, LadderRow } from "../lib/api";
import { buildFinalsBracket, teamsAliveInFinals, winnerOf, FINALS_ROUNDS } from "../lib/finalsBracket";
import { useRefreshTick } from "../lib/refresh";
import TeamBadge from "./TeamBadge";

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
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api
      .getLadder()
      .then((l) => setLadderRows(l.rows))
      .catch(() => setLadderRows((prev) => prev ?? []));
    Promise.all(FINALS_ROUNDS.map((round) => api.listGames(round)))
      .then((results) => setGames(results.flat()))
      .catch(() => setGames((prev) => prev ?? []));
    api
      .listFinalsInjuries()
      .then(setInjuries)
      .catch(() => setInjuries((prev) => prev ?? []));
  }, [refreshTick]);

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

  const statusLabel = (st: FinalsInjuryEntry["status"]) =>
    st === "OUT" ? "Out" : st === "LIKELY" ? "Likely" : st === "UNLIKELY" ? "Unlikely" : st;
  const statusClass = (st: FinalsInjuryEntry["status"]) =>
    st === "OUT"
      ? "text-brand-siren bg-brand-siren/[.12]"
      : st === "LIKELY"
        ? "text-brand-violet bg-brand-violet/[.12]"
        : "text-white/50 bg-white/[.06]";

  return (
    <Link
      to="/finals#injury-watch"
      className="block bg-surface border border-white/[.07] rounded-[18px] px-4 pt-3.5 pb-1.5 hover:border-brand-violet/45 transition-colors duration-150"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
          Finals Injury Watch
        </span>
        <span className="text-[12.5px] font-bold text-brand-violet">See all {relevant.length} →</span>
      </div>

      {preview.map((e, i) => (
        <div key={e.id} className={`flex items-center gap-3 py-[11px] ${i > 0 ? "border-t border-white/[.05]" : ""}`}>
          <TeamBadge team={e.team} size="sm" />
          <div className="min-w-0 flex-1 flex flex-col">
            <span className="text-[14px] font-bold text-white truncate">{e.player}</span>
            <span className="text-[12px] text-slate-400 truncate">{e.injury}</span>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider ${statusClass(e.status)}`}
          >
            {statusLabel(e.status)}
          </span>
        </div>
      ))}
    </Link>
  );
}
