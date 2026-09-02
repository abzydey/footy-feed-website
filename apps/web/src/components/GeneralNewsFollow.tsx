import { Link } from "react-router-dom";

import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";
import FollowButton from "./FollowButton";

/**
 * Opt-in for breaking NRL news that isn't tied to any one team — a separate
 * follow target (LEAGUE), but still just an Event (type GENERAL_NEWS) under
 * the hood. See schema.prisma design notes. The card itself links to its
 * own dedicated page (GeneralNewsPage, same pattern as a team or game page),
 * same as a team tile links to that team's page — only the Follow button is
 * a separate click target.
 */
export default function GeneralNewsFollow() {
  return (
    <Link
      to="/news"
      className="rounded-xl bg-surface border border-white/10 shadow-card hover:border-white/20 hover:bg-surface-hover transition-all duration-150 active:scale-[0.98] p-4 flex items-center justify-between gap-3"
    >
      <div>
        <div className="text-white font-display font-extrabold tracking-tight text-base">NRL News</div>
        <p className="text-xs text-slate-400 mt-0.5">Breaking league-wide stories, not tied to one team.</p>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <FollowButton
          targetType="LEAGUE"
          targetId={GENERAL_NEWS_TARGET_ID}
          label="Follow"
          followingLabel="✓ Following"
        />
      </div>
    </Link>
  );
}
