import { Team } from "../lib/api";
import { teamAbbreviation, teamBadgeBackground } from "../lib/teamBadge";

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-[10.5px]",
  md: "w-[46px] h-[46px] text-[14px]",
  lg: "w-14 h-14 text-[16px]",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "slug" | "shortName" | "primaryColor">;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

// A generic shield silhouette (not modelled on any real club's crest
// outline) rather than a plain circle — reads as a sports badge instead of
// a coloured dot. Every badge uses the exact same polygon regardless of
// team, so the shape itself carries none of the club-specific identity;
// only the fill pattern does.
const SHIELD_CLIP = "polygon(50% 0%, 93% 13%, 93% 58%, 50% 100%, 7% 58%, 7% 13%)";

// A colourful geometric pattern (see teamBadgeBackground) built from the
// team's real colours, standing in for a real crest we don't have rights
// to reproduce. Falls back to a plain surface-inset fill for a team with no
// primaryColor set yet. Every badge — regardless of team or fallback state —
// gets the same treatment: one shield silhouette, one thin border, one
// drop-shadow for depth, one text weight/tracking for the code on top, so
// the set reads as a unified system rather than 17 one-off looks.
// drop-shadow (a filter, not box-shadow) is used for the lift because it
// follows the clip-path silhouette; box-shadow would draw against the
// element's underlying rectangle and show through the shield's cut corners.
export default function TeamBadge({ team, size = "md", className = "" }: TeamBadgeProps) {
  const background = teamBadgeBackground(team);
  return (
    <div
      className={`shrink-0 flex items-center justify-center border border-white/[.18] font-display font-bold leading-none tracking-tight text-white ${
        background ? "" : "bg-surface-inset"
      } ${SIZE_CLASSES[size]} ${className}`}
      style={{
        background,
        clipPath: SHIELD_CLIP,
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
        textShadow: background ? "0 1px 3px rgba(0,0,0,0.85)" : undefined,
      }}
    >
      {teamAbbreviation(team)}
    </div>
  );
}
