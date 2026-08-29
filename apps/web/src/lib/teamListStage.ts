export type TeamListStage = "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL";

export const STAGE_LABEL: Record<TeamListStage, string> = {
  INITIAL: "Initial Team",
  TWENTY_FOUR_HOUR: "24hr Update",
  FINAL: "Final Update",
};

// FINAL gets a distinct, urgent color (amber) — the ~1.5hr-before-kickoff
// late-change moment fantasy/punting users care about most. INITIAL/24HR
// use the standard brand accent.
export const STAGE_BADGE_CLASS: Record<TeamListStage, string> = {
  INITIAL: "bg-brand-violet/20 text-brand-heliotrope border-brand-violet/50",
  TWENTY_FOUR_HOUR: "bg-brand-violet/20 text-brand-heliotrope border-brand-violet/50",
  FINAL: "bg-amber-500/20 text-amber-400 border-amber-500/50",
};
