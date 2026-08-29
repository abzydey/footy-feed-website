import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, RoundLineups } from "../lib/api";

function hasAnyStage(stages: RoundLineups["games"][number]["homeTeamLineup"]) {
  return stages.INITIAL != null || stages.TWENTY_FOUR_HOUR != null || stages.FINAL != null;
}

// A standalone summary card linking into the Team Lists page — same visual
// weight as NextGameCard, and deliberately its own element rather than
// folded into the news feed below, since "have team lists dropped for my
// game yet" is a different kind of check than reading news.
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
      className="cursor-pointer rounded-[18px] p-[1.5px] bg-gradient-to-br from-brand-violet via-brand-blue to-white/[.06]"
    >
      <div className="flex items-center justify-between gap-3 rounded-[16.5px] bg-gradient-to-b from-[#191830] to-[#111119] px-4 py-[18px]">
        <div className="min-w-0">
          <div className="font-display font-bold text-[12.5px] tracking-[.16em] text-white/50 uppercase mb-1">
            Team lists
          </div>
          <div className="font-display font-extrabold text-lg text-white truncate">
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
