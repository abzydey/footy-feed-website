import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, RoundLineups } from "../lib/api";

function hasAnyStage(stages: RoundLineups["games"][number]["homeTeamLineup"]) {
  return stages.INITIAL != null || stages.TWENTY_FOUR_HOUR != null || stages.FINAL != null;
}

// A standalone summary card linking into the Team Lists page — deliberately
// its own element rather than folded into the news feed below, since "have
// team lists dropped for my game yet" is a different kind of check than
// reading news. With the old hero banner gone, this is the first bordered
// card on Home, doing the "grab attention immediately" job the banner used
// to do — so it carries a violet glow + a live-pulse kicker dot that no
// other Home card gets, rather than everything reading as same-weight.
export default function TeamListsCard() {
  const navigate = useNavigate();
  const [data, setData] = useState<RoundLineups | null>(null);

  useEffect(() => {
    api.getCurrentRoundLineups().then(setData).catch(() => setData(null));
  }, []);

  if (!data || data.games.length === 0) return null;

  const updatedCount = data.games.filter(
    (g) => hasAnyStage(g.homeTeamLineup) || hasAnyStage(g.awayTeamLineup)
  ).length;

  return (
    <div
      onClick={() => navigate("/team-lists")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/team-lists")}
      className="cursor-pointer rounded-[18px] p-[1.5px] bg-gradient-to-br from-brand-violet via-brand-heliotrope to-white/[.06] shadow-[0_0_28px_-6px_rgba(139,77,255,0.55)]"
    >
      <div className="flex items-center justify-between gap-3 rounded-[16.5px] bg-[linear-gradient(160deg,#141B33_0%,#0A1024_100%)] px-4 py-5">
        <div className="min-w-0">
          <div className="flex items-center gap-[7px] mb-1.5">
            <span className="relative flex h-[7px] w-[7px] shrink-0">
              <span className="absolute inset-0 rounded-full bg-brand-violet animate-ping opacity-75" />
              <span className="relative rounded-full h-[7px] w-[7px] bg-brand-violet" />
            </span>
            <span className="font-display font-bold text-[12.5px] tracking-[.16em] text-brand-heliotrope uppercase">
              Team lists
            </span>
          </div>
          <div className="font-display font-extrabold text-xl text-white truncate">
            {data.round ? `${data.round} team lists` : "Team lists"} — {updatedCount} of {data.games.length} games
            updated
          </div>
        </div>
        <span className="shrink-0 flex items-center gap-1.5 text-[12.5px] font-extrabold tracking-[.03em] uppercase rounded-full px-4 py-2.5 bg-white text-app">
          View all
        </span>
      </div>
    </div>
  );
}
