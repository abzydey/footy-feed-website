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

// Original two-tone (occasionally three-tone) geometric patterns for the
// badge fill — not a copy of any club's actual crest (which we don't have
// rights to reproduce), just a colourful, distinct pattern per club that
// echoes real kit colour-blocking. primaryColor comes from the Team record;
// secondary/tertiary here are audited against each club's current official
// colours (Wikipedia infobox hex + club/NRL Shop product listings, Sep
// 2026 — not assumed from general knowledge, since branding moves season
// to season) rather than defaulting every club to white. A couple of
// primaryColor values turned out to be wrong against that same audit and
// were corrected in the database directly (see the admin data-entry
// scripts), not here — this file only supplies what the DB doesn't store.
type BadgePattern =
  | "solid"
  | "halves-v"
  | "halves-h"
  | "diagonal"
  | "stripes-h"
  | "stripes-v"
  | "quarters"
  | "ring"
  | "tri-stripes-h"
  | "diagonal-band";

interface BadgeStyle {
  pattern: BadgePattern;
  secondary: string;
  tertiary?: string;
  // diagonal-band only: a 2-3 colour band cutting across the primary field,
  // for a club whose real identity needs more than a 2-tone split.
  band?: string[];
}

const TEAM_BADGE_STYLE: Record<string, BadgeStyle> = {
  broncos: { pattern: "ring", secondary: "#FABF16" }, // maroon + gold
  raiders: { pattern: "stripes-h", secondary: "#FFFFFF" }, // lime green + white
  bulldogs: { pattern: "halves-v", secondary: "#FFFFFF" }, // blue + white
  sharks: { pattern: "stripes-v", secondary: "#FFFFFF" }, // sky blue + white
  titans: { pattern: "diagonal", secondary: "#FFD02F" }, // light blue + gold
  "sea-eagles": { pattern: "stripes-h", secondary: "#FFFFFF" }, // maroon + white
  storm: { pattern: "quarters", secondary: "#F9B019" }, // purple + gold
  // Confirmed against a photo of the actual club colours sent directly:
  // navy dominant, thin green band, thin red band — no teal or black
  // anywhere, matching every official source checked (Wikipedia infobox
  // hex #0d249f, the 2026 NRL Shop home jersey listing "BLUE").
  warriors: { pattern: "tri-stripes-h", secondary: "#008643", tertiary: "#DA291C" }, // navy + green + red
  knights: { pattern: "halves-h", secondary: "#EE3524" }, // blue + red
  cowboys: { pattern: "diagonal", secondary: "#FFDD02" }, // navy + gold
  eels: { pattern: "quarters", secondary: "#FFD326" }, // blue + gold
  // Confirmed against the actual "2017 colours" club flag sent directly:
  // black field with a red/yellow/green diagonal band — the club dropped
  // teal for this scheme ahead of the 2017 season and has stayed on it
  // since, per both that image and the current official jersey listing.
  panthers: { pattern: "diagonal-band", secondary: "#FFFFFF", band: ["#BB302F", "#E8D148", "#2C9C29"] }, // black, red/yellow/green band
  rabbitohs: { pattern: "halves-v", secondary: "#003C1A" }, // cardinal red + myrtle green
  dragons: { pattern: "stripes-h", secondary: "#FFFFFF" }, // red + white
  // True tricolour, not a 2-tone approximation — Roosters have worn navy/
  // white/red since 1908, so a plain halves split was dropping a whole
  // official colour.
  roosters: { pattern: "tri-stripes-h", secondary: "#FFFFFF", tertiary: "#E82C2E" }, // navy + white + red
  dolphins: { pattern: "ring", secondary: "#FFFFFF" }, // red + white (gold is a minor trim, not equal partner)
  "wests-tigers": { pattern: "stripes-v", secondary: "#000000" }, // orange + black tiger stripes
};

// CSS background values only — no SVG needed, and every one of these packs
// down to a single declarative gradient string.
function patternBackground(style: BadgeStyle, c1: string): string {
  const { pattern, secondary: c2, tertiary: c3, band } = style;
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
    case "tri-stripes-h":
      return `repeating-linear-gradient(180deg, ${c1} 0, ${c1} 16%, ${c2} 16%, ${c2} 32%, ${c3 ?? c2} 32%, ${c3 ?? c2} 48%)`;
    case "diagonal-band": {
      const [b1, b2, b3] = band ?? [c2, c2, c2];
      return `linear-gradient(135deg, ${c1} 0, ${c1} 30%, ${b1} 30%, ${b1} 43%, ${b2} 43%, ${b2} 56%, ${b3} 56%, ${b3} 69%, ${c1} 69%, ${c1} 100%)`;
    }
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
  const style = TEAM_BADGE_STYLE[team.slug] ?? { pattern: "solid" as const, secondary: "#FFFFFF" };
  return patternBackground(style, team.primaryColor);
}
