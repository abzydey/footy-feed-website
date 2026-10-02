import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, RoundLineups } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";

const STALE_AFTER_DAYS = 3;

function hasAnyStage(stages: RoundLineups["games"][number]["homeTeamLineup"]) {
  return stages.INITIAL != null || stages.TWENTY_FOUR_HOUR != null || stages.FINAL != null;
}

// A one-line summary row linking into the Team Lists page — "have team
// lists dropped for my game yet" is its own kind of check, separate from
// the news below. The whole row is the tap target; the title gets the full
// width (it used to be cut off beside a big VIEW ALL button), and the
// pulsing dot only shows once at least one game's lists are in.
export default function TeamListsCard() {
  const [data, setData] = useState<RoundLineups | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api.getCurrentRoundLineups().then(setData).catch(() => {});
  }, [refreshTick]);

  if (!data || data.games.length === 0) return null;

  // After the last round of the season (the Grand Final) there's no next
  // round to point at, so the API keeps returning the finished one — hide
  // the card a few days after every game in it is done.
  const lastKickoff = Math.max(...data.games.map((g) => new Date(g.game.kickoffAt).getTime()));
  const roundOver = data.games.every((g) => g.game.status === "FULL_TIME");
  if (roundOver && Date.now() - lastKickoff > STALE_AFTER_DAYS * 86_400_000) return null;

  const updatedCount = data.games.filter(
    (g) => hasAnyStage(g.homeTeamLineup) || hasAnyStage(g.awayTeamLineup)
  ).length;

  return (
    <Link
      to="/team-lists"
      className="flex items-center gap-3 rounded-[18px] px-4 py-3.5 bg-surface border border-brand-violet/30 shadow-[0_0_24px_-10px_theme(colors.brand.violet/60%)] hover:border-brand-violet/55 transition-colors duration-150"
    >
      <span className="shrink-0 w-10 h-10 rounded-xl bg-brand-violet/15 text-brand-violet flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <circle cx="4.5" cy="6" r="1" />
          <circle cx="4.5" cy="12" r="1" />
          <circle cx="4.5" cy="18" r="1" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 flex flex-col gap-[3px]">
        <span className="flex items-center gap-[7px]">
          {updatedCount > 0 && (
            <span className="relative flex h-[7px] w-[7px] shrink-0">
              <span className="absolute inset-0 rounded-full bg-brand-violet animate-ping opacity-75" />
              <span className="relative rounded-full h-[7px] w-[7px] bg-brand-violet" />
            </span>
          )}
          <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
            Team lists{updatedCount > 0 ? " · Updated" : ""}
          </span>
        </span>
        <span className="font-extrabold text-[15.5px] leading-tight text-white">
          {data.round ? `${data.round} team lists` : "Team lists"}
        </span>
        <span className="text-[12.5px] text-slate-400">
          {updatedCount} of {data.games.length} {data.games.length === 1 ? "game" : "games"} updated
        </span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-500" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
