import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";
import FollowButton from "./FollowButton";

/**
 * Opt-in for breaking NRL news that isn't tied to any one team — a separate
 * follow target (LEAGUE), but still just an Event (type GENERAL_NEWS) under
 * the hood. See schema.prisma design notes.
 */
export default function GeneralNewsFollow() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-white font-medium text-sm">General NRL News</div>
        <p className="text-xs text-slate-400">Breaking league-wide stories, not tied to one team.</p>
      </div>
      <FollowButton
        targetType="LEAGUE"
        targetId={GENERAL_NEWS_TARGET_ID}
        label="Follow"
        followingLabel="✓ Following"
      />
    </div>
  );
}
