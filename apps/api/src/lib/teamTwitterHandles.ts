// Maps a club's official X handle (lowercase, no @) to its Team.slug.
// Originally lived only in liveScorePoller.ts (for matching a tweeted score
// line's two @handles to real Team rows); shared here so socialPoller.ts can
// use the exact same mapping to tag a club account's own posts with a real
// teamId — needed for the Social page's team filter to have anything to
// show, since an untagged post only ever appears under "All".
export const HANDLE_TO_TEAM_SLUG: Record<string, string> = {
  brisbanebroncos: "broncos",
  raiderscanberra: "raiders",
  nrl_bulldogs: "bulldogs",
  cronullasharks: "sharks",
  dolphinsnrl: "dolphins",
  gctitans: "titans",
  seaeagles: "sea-eagles",
  storm: "storm",
  nzwarriors: "warriors",
  nrlknights: "knights",
  nthqldcowboys: "cowboys",
  theparraeels: "eels",
  penrithpanthers: "panthers",
  ssfcrabbitohs: "rabbitohs",
  nrl_dragons: "dragons",
  sydneyroosters: "roosters",
  weststigers: "wests-tigers",
};
