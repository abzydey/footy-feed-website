import { Team } from "../lib/api";
import { teamAbbreviation, teamBadgeBackground } from "../lib/teamBadge";

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-[46px] h-[46px] text-[15px]",
  lg: "w-14 h-14 text-[17px]",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "slug" | "shortName" | "primaryColor">;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

// A colourful two-tone geometric pattern (see teamBadgeBackground) built
// from the team's real primaryColor + white, standing in for a real crest
// we don't have rights to reproduce. Falls back to a plain surface-inset
// fill for a team with no primaryColor set yet. The abbreviation sits on
// top with a dark text-shadow rather than a plain solid colour — some
// patterns put light-on-light or colour-on-colour behind the letters, and
// the shadow keeps them legible regardless of which pattern lands under
// them.
export default function TeamBadge({ team, size = "md", className = "" }: TeamBadgeProps) {
  const background = teamBadgeBackground(team);
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-display font-bold text-white ${
        background ? "" : "bg-surface-inset"
      } ${SIZE_CLASSES[size]} ${className}`}
      style={{ background, textShadow: background ? "0 1px 3px rgba(0,0,0,0.85)" : undefined }}
    >
      {teamAbbreviation(team)}
    </div>
  );
}
