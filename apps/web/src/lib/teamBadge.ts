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
  // Pixel-sampled directly from the club's own official reference swatch
  // (Wikimedia Commons "2024 Cronulla-Sutherland Sharks Colours.png": sky
  // blue #6FD0EF, black #000000, no white shown at all) rather than a
  // third-party logo-colour extraction — primaryColor updated to match.
  sharks: { pattern: "stripes-v", secondary: "#000000" }, // sky blue + black
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

// A thin neutral "seam" at every hard colour boundary — softens what would
// otherwise be a stark 50/50 pie-chart-style split into something that
// reads more like a stitched/moulded badge. Generated once per pattern
// rather than hand-typed per boundary, since several patterns (tri-stripe,
// quarters) have 3-4 boundaries each and hand-authoring every percentage
// is exactly the kind of thing that drifts out of sync when a pattern
// changes.
const SEAM = "rgba(0,0,0,0.32)";

// Bands along a straight line, each flanked by a seam on every internal
// boundary (not the two outer edges, which meet the badge's own silhouette
// instead). Used for halves-v/h and diagonal (equal widths, n=2 — this is
// what "soften the halves" resolves to by construction) and for
// diagonal-band's asymmetric black/colour/colour/colour/black split, via
// explicit weights rather than assuming every band is the same size.
function linearBands(angleDeg: number, colors: string[], weights?: number[], seamPct = 1.6): string {
  const n = colors.length;
  const total = weights ? weights.reduce((a, b) => a + b, 0) : n;
  const widths = (weights ?? colors.map(() => 1)).map((w) => (w / total) * 100);
  const stops: string[] = [];
  let boundary = 0;
  for (let i = 0; i < n; i++) {
    const start = boundary;
    const end = start + widths[i];
    const segStart = i === 0 ? start : start + seamPct;
    const segEnd = i === n - 1 ? end : end - seamPct;
    stops.push(`${colors[i]} ${segStart}%`, `${colors[i]} ${segEnd}%`);
    if (i < n - 1) stops.push(`${SEAM} ${segEnd}%`, `${SEAM} ${end + seamPct}%`);
    boundary = end;
  }
  return `linear-gradient(${angleDeg}deg, ${stops.join(", ")})`;
}

// Same idea, but every band (including the first and last) is flanked by a
// seam on both sides, because a repeating pattern's "last" band sits right
// next to its own "first" band at the tile wrap — without a seam there too,
// one of the four-plus boundaries in a repeating stripe would stay a hard
// cut while the others were softened.
function repeatingBands(angleDeg: number, colors: string[], bandPct: number, seamPct = 1.6): string {
  const stops: string[] = [];
  let pos = 0;
  for (const color of colors) {
    stops.push(`${SEAM} ${pos}%`, `${SEAM} ${pos + seamPct}%`);
    pos += seamPct;
    stops.push(`${color} ${pos}%`, `${color} ${pos + bandPct}%`);
    pos += bandPct;
  }
  return `repeating-linear-gradient(${angleDeg}deg, ${stops.join(", ")})`;
}

// Same wrap-aware seaming, in turns, for the conic "quarters" pattern.
function conicBands(colors: string[], seamTurn = 0.014): string {
  const n = colors.length;
  const bandTurn = 1 / n;
  const stops: string[] = [`${SEAM} 0turn`, `${SEAM} ${seamTurn}turn`];
  let pos = seamTurn;
  for (let i = 0; i < n; i++) {
    const segEnd = pos + bandTurn - seamTurn * 2;
    stops.push(`${colors[i]} ${pos}turn`, `${colors[i]} ${segEnd}turn`);
    pos = segEnd;
    stops.push(`${SEAM} ${pos}turn`, `${SEAM} ${pos + seamTurn * 2}turn`);
    pos += seamTurn * 2;
  }
  return `conic-gradient(${stops.join(", ")})`;
}

// CSS background values only — no SVG needed, and every one of these packs
// down to a single declarative gradient string. A soft diagonal sheen is
// layered on top of every pattern (painted first — background layers stack
// with the first listed on top) so the fill reads as a moulded badge with
// some depth rather than a flat colour block; the outer drop-shadow that
// does the rest of that job lives in TeamBadge.tsx since box/drop-shadow
// isn't a background value.
const SHEEN = "linear-gradient(155deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,0) 48%)";

function patternBackground(style: BadgeStyle, c1: string): string {
  const { pattern, secondary: c2, tertiary: c3, band } = style;
  let fill: string;
  switch (pattern) {
    case "halves-v":
      fill = linearBands(90, [c1, c2]);
      break;
    case "halves-h":
      fill = linearBands(180, [c1, c2]);
      break;
    case "diagonal":
      fill = linearBands(135, [c1, c2]);
      break;
    case "stripes-h":
      fill = repeatingBands(180, [c1, c2], 18);
      break;
    case "stripes-v":
      fill = repeatingBands(90, [c1, c2], 18);
      break;
    case "tri-stripes-h":
      fill = repeatingBands(180, [c1, c2, c3 ?? c2], 13);
      break;
    case "diagonal-band": {
      const [b1, b2, b3] = band ?? [c2, c2, c2];
      fill = linearBands(135, [c1, b1, b2, b3, c1], [30, 13, 13, 13, 31]);
      break;
    }
    case "quarters":
      fill = conicBands([c1, c2, c1, c2]);
      break;
    case "ring":
      fill = `radial-gradient(circle, ${c2} 0 52%, ${SEAM} 52% 56%, ${c1} 56% 100%)`;
      break;
    case "solid":
    default:
      fill = c1;
  }
  return `${SHEEN}, ${fill}`;
}

// Falls back to a flat surface-inset fill (no pattern) when a team has no
// primaryColor yet (e.g. an expansion club still being onboarded) — same
// safe default the old plain-ring badge used.
export function teamBadgeBackground(team: { slug: string; primaryColor: string | null }): string | undefined {
  if (!team.primaryColor) return undefined;
  const style = TEAM_BADGE_STYLE[team.slug] ?? { pattern: "solid" as const, secondary: "#FFFFFF" };
  return patternBackground(style, team.primaryColor);
}
