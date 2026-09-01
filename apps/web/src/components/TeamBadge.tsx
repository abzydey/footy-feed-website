import { Team } from "../lib/api";
import { teamAbbreviation } from "../lib/teamBadge";

const SIZE_CLASSES = {
  sm: "w-8 h-8 text-[11px] border-[1.5px]",
  md: "w-[46px] h-[46px] text-[15px] border-2",
  lg: "w-14 h-14 text-[17px] border-2",
} as const;

interface TeamBadgeProps {
  team: Pick<Team, "slug" | "shortName" | "primaryColor">;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

// A team-colour ring around the app's standard inset-fill circle, rather
// than a solid colour fill — keeps the crest chip legible and consistent
// with the rest of the dark-surface design system (see surface.inset in
// tailwind.config.js) regardless of how bright/dark an individual team's
// colour is, without needing per-team contrast calculations for the text.
// Falls back to a plain surface-inset circle (no ring) for a team with no
// primaryColor set yet.
export default function TeamBadge({ team, size = "md", className = "" }: TeamBadgeProps) {
  return (
    <div
      className={`shrink-0 rounded-full bg-surface-inset flex items-center justify-center font-display font-bold text-white/90 ${SIZE_CLASSES[size]} ${className}`}
      style={team.primaryColor ? { borderColor: team.primaryColor, borderStyle: "solid" } : undefined}
    >
      {teamAbbreviation(team)}
    </div>
  );
}
