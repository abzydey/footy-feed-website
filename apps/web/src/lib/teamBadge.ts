// Real NRL broadcast/draw abbreviations — replaces the old naive
// shortName.slice(0, 3) (e.g. "Sharks" -> "SHA" instead of the real "CRO").
export const TEAM_ABBREVIATIONS: Record<string, string> = {
  broncos: "BRI",
  raiders: "CBR",
  bulldogs: "CBY",
  sharks: "CRO",
  titans: "GLD",
  "sea-eagles": "MAN",
  storm: "MEL",
  knights: "NEW",
  cowboys: "NQL",
  eels: "PAR",
  panthers: "PEN",
  rabbitohs: "SOU",
  dragons: "STG",
  roosters: "SYD",
  "wests-tigers": "WST",
  warriors: "WAR",
  dolphins: "DOL",
};

export function teamAbbreviation(team: { slug: string; shortName: string }): string {
  return TEAM_ABBREVIATIONS[team.slug] ?? team.shortName.slice(0, 3).toUpperCase();
}

// Original two-tone geometric patterns for the badge fill, built from each
// team's real primaryColor + white — not a copy of any club's actual crest
// (which we don't have rights to reproduce), just a colourful, distinct
// pattern per club so badges read as more than a flat ring, the way a
// jersey's own colour-blocking would. Assigned by hand rather than a
// blind hash so a few clubs land on the pattern closest to their actual
// kit (e.g. Rabbitohs' cardinal/myrtle vertical halves, Sea Eagles'
// horizontal bands) while the rest just get a pleasant, distinct spread.
type BadgePattern = "solid" | "halves-v" | "halves-h" | "diagonal" | "stripes-h" | "stripes-v" | "quarters" | "ring";

const TEAM_BADGE_PATTERN: Record<string, BadgePattern> = {
  broncos: "ring",
  raiders: "stripes-h",
  bulldogs: "halves-v",
  sharks: "stripes-v",
  titans: "diagonal",
  "sea-eagles": "stripes-h",
  storm: "quarters",
  warriors: "ring",
  knights: "halves-h",
  cowboys: "diagonal",
  eels: "quarters",
  panthers: "stripes-v",
  rabbitohs: "halves-v",
  dragons: "stripes-h",
  roosters: "halves-h",
  dolphins: "ring",
  "wests-tigers": "stripes-v",
};

// CSS background values only — no SVG needed, and every one of these packs
// down to a single declarative gradient string.
function patternBackground(pattern: BadgePattern, c1: string, c2: string): string {
  switch (pattern) {
    case "halves-v":
      return `linear-gradient(90deg, ${c1} 50%, ${c2} 50%)`;
    case "halves-h":
      return `linear-gradient(180deg, ${c1} 50%, ${c2} 50%)`;
    case "diagonal":
      return `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
    case "stripes-h":
      return `repeating-linear-gradient(180deg, ${c1} 0, ${c1} 20%, ${c2} 20%, ${c2} 40%)`;
    case "stripes-v":
      return `repeating-linear-gradient(90deg, ${c1} 0, ${c1} 20%, ${c2} 20%, ${c2} 40%)`;
    case "quarters":
      return `conic-gradient(${c1} 0turn 0.25turn, ${c2} 0.25turn 0.5turn, ${c1} 0.5turn 0.75turn, ${c2} 0.75turn 1turn)`;
    case "ring":
      return `radial-gradient(circle, ${c2} 0 55%, ${c1} 55% 100%)`;
    case "solid":
    default:
      return c1;
  }
}

// Falls back to a flat surface-inset fill (no pattern) when a team has no
// primaryColor yet (e.g. an expansion club still being onboarded) — same
// safe default the old plain-ring badge used.
export function teamBadgeBackground(team: { slug: string; primaryColor: string | null }): string | undefined {
  if (!team.primaryColor) return undefined;
  const pattern = TEAM_BADGE_PATTERN[team.slug] ?? "solid";
  return patternBackground(pattern, team.primaryColor, "#FFFFFF");
}
