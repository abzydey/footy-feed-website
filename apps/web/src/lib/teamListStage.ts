export type TeamListStage = "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL";

export const STAGE_LABEL: Record<TeamListStage, string> = {
  INITIAL: "Initial Team",
  TWENTY_FOUR_HOUR: "24hr Update",
  FINAL: "Final Update",
};

// FINAL gets Siren — the brand's one warm accent, reserved for "happening
// right now" moments (late change, imminent kickoff). The ~1.5hr-before-
// kickoff late-change is exactly that. INITIAL/24HR use the standard brand
// accent (purple).
export const STAGE_BADGE_CLASS: Record<TeamListStage, string> = {
  INITIAL: "bg-brand-violet/20 text-brand-heliotrope border-brand-violet/50",
  TWENTY_FOUR_HOUR: "bg-brand-violet/20 text-brand-heliotrope border-brand-violet/50",
  FINAL: "bg-brand-siren/[.14] text-brand-siren border-brand-siren/[.38]",
};
