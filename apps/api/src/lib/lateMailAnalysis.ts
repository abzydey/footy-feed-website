import { prisma } from "./prisma";
import { ParsedLateMail, ParsedPlayer, ParsedTeamSheet } from "./lateMailParser";

// Shared by routes/adminLateMail.ts (manual/chat-triggered parse-and-review)
// and lib/lateMailPoller.ts (automatic polling — see that file for what it
// does with this). Both need the exact same team-matching, shape-checking,
// and body-generation logic so a scraped list reads identically whether a
// human reviewed it first or it was auto-published.

// Same "N. Name" format every other team-list body in the app uses
// (parseTeamList in TeamListCard.tsx), so a published result renders
// exactly like a hand-entered one — the two-column grid, strikethrough,
// and changed-player highlighting all just work.
function playersToText(players: ParsedPlayer[]): string {
  return players.map((p) => `${p.number}. ${p.name}`).join(", ");
}

function buildBody(sheet: ParsedTeamSheet, omitted: { names: string[]; initialSquadSize: number }): string {
  let body = `${playersToText(sheet.starters)}. Bench: ${playersToText(sheet.interchange)}.`;
  if (sheet.reserves.length > 0) body += ` Reserves: ${playersToText(sheet.reserves)}.`;
  if (omitted.names.length > 0) {
    body += ` Omitted from the ${omitted.initialSquadSize} — ${omitted.names.join(", ")}.`;
  }
  return body;
}

// Compares a freshly-scraped roster against whatever's already on file as
// this game's INITIAL list, so a re-fetch later in the week (same URL,
// updated by NRL.com — see lib/lateMailParser.ts) can surface the omission
// sentence automatically instead of the admin re-deriving it by hand.
// initialSquadSize is the actual count of names in that INITIAL body, not
// assumed to always be 22 — matches how every hand-entered omission
// sentence this session used the real original squad count.
export function computeOmitted(sheet: ParsedTeamSheet, initialBody: string | undefined): { names: string[]; initialSquadSize: number } {
  if (!initialBody) return { names: [], initialSquadSize: 0 };
  const currentNames = new Set(
    [...sheet.starters, ...sheet.interchange, ...sheet.reserves].map((p) => p.name.toLowerCase())
  );
  const initialNames = [...initialBody.matchAll(/\d{1,2}\.\s*([^,.]+?)(?=,|\.|$)/g)].map((m) => m[1].trim());
  return {
    names: initialNames.filter((name) => !currentNames.has(name.toLowerCase())),
    initialSquadSize: initialNames.length,
  };
}

function hoursUntil(date: Date): number {
  return (date.getTime() - Date.now()) / (60 * 60 * 1000);
}

// Purely a UI default — never trusted as fact. INITIAL is the normal
// Tuesday-release window; FINAL is the ~90min pre-kickoff window (see
// TeamListCard.tsx's PLACEHOLDER_OFFSET_MS for the same thresholds used
// elsewhere); everything in between defaults to 24hr.
export function suggestStage(kickoffAt: Date): "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL" {
  const hrs = hoursUntil(kickoffAt);
  if (hrs > 36) return "INITIAL";
  if (hrs < 3) return "FINAL";
  return "TWENTY_FOUR_HOUR";
}

export type Stage = "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL";

// Each stage has a genuinely different expected shape, not just "reserves
// count varies" — starters/interchange are fixed at 13/6 throughout, and
// the reserve count itself steps down through the week as NRL.com trims
// the extended squad toward the real matchday 19:
//   Initial (Tuesday):        22 = 13 + 6 + 3 reserves
//   24hr Update:               20 = 13 + 6 + 1 reserve
//   Final Update (~90min out): 19 = 13 + 6 + 0 reserves — no Reserves
//     section at all is the *correct* shape here, not a bug.
export const EXPECTED_SHAPE: Record<Stage, { starters: number; interchange: number; reserves: number }> = {
  INITIAL: { starters: 13, interchange: 6, reserves: 3 },
  TWENTY_FOUR_HOUR: { starters: 13, interchange: 6, reserves: 1 },
  FINAL: { starters: 13, interchange: 6, reserves: 0 },
};

// Specific, readable mismatch messages rather than one generic boolean —
// e.g. a Final unexpectedly still showing a reserve is just as worth
// surfacing as an Initial that's short on them, and either message says
// exactly what's off rather than making the admin re-derive it.
export function shapeWarnings(
  stage: Stage,
  sheet: { starters: ParsedPlayer[]; interchange: ParsedPlayer[]; reserves: ParsedPlayer[] }
): string[] {
  const expected = EXPECTED_SHAPE[stage];
  const warnings: string[] = [];
  if (sheet.starters.length !== expected.starters) {
    warnings.push(`${sheet.starters.length} starter${sheet.starters.length === 1 ? "" : "s"} found (expected ${expected.starters})`);
  }
  if (sheet.interchange.length !== expected.interchange) {
    warnings.push(`${sheet.interchange.length} on the interchange (expected ${expected.interchange})`);
  }
  if (sheet.reserves.length !== expected.reserves) {
    warnings.push(`${sheet.reserves.length} reserve${sheet.reserves.length === 1 ? "" : "s"} found (expected ${expected.reserves} at this stage)`);
  }
  return warnings;
}

// Same "N. Name" parsing convention as parseTeamList in TeamListCard.tsx,
// ported server-side to read a *stored* body (INITIAL) back into named
// sections — needed by generateTwentyFourHourBody below to know who was
// where at INITIAL, not just who's missing entirely (computeOmitted only
// answers the latter).
const STORED_NUMBERED_PLAYER = /(\d{1,2})\.\s*([^,.]+?)(?=,|\.|$)/g;

interface StoredSheet {
  starters: string[];
  interchange: string[];
  reserves: string[];
}

function parseStoredBody(body: string): StoredSheet | null {
  const total = [...body.matchAll(STORED_NUMBERED_PLAYER)];
  if (total.length < 10) return null; // not a full structured list (e.g. already prose) — nothing to diff against
  const benchIdx = body.indexOf("Bench:");
  if (benchIdx === -1) return null;
  const reservesIdx = body.indexOf("Reserves:");
  const extract = (seg: string) => [...seg.matchAll(STORED_NUMBERED_PLAYER)].map((m) => m[2].trim());
  return {
    starters: extract(body.slice(0, benchIdx)),
    interchange: extract(reservesIdx === -1 ? body.slice(benchIdx) : body.slice(benchIdx, reservesIdx)),
    reserves: reservesIdx === -1 ? [] : extract(body.slice(reservesIdx)),
  };
}

export interface TwentyFourHourResult {
  // null when the update can't be described safely — see reason.
  body: string | null;
  reason?: string;
}

// Starting positions by list order — NRL.com lists the 13 in position
// order, and jersey numbers stay with the player when they move (a bench
// player starting at hooker still wears 14), so the slot, not the number,
// says which position someone is playing.
const STARTING_POSITIONS = [
  "fullback", "wing", "centre", "centre", "wing", "five-eighth", "halfback",
  "prop", "hooker", "prop", "second row", "second row", "lock",
];

// "the suspended Phoenix Crossland", "Ryan Papenhuyzen (hamstring)", or just
// the name when we have no reason on file — never a guessed one.
function describeOut(name: string, reasons: Map<string, string>): string {
  const reason = reasons.get(name.toLowerCase());
  if (!reason) return name;
  if (/^suspen/i.test(reason)) return `the suspended ${name}`;
  return `${name} (${reason.charAt(0).toLowerCase()}${reason.slice(1)})`;
}

// Writes the 24-hour update the way they've been written all season:
// "Omitted from the NN — ..." (drives the strikethrough on Tuesday's list),
// what changed and why, then "X remains the one reserve as the Team trim
// their squad ahead of Day's clash with Opponent".
//
// Handles every routine change — reserves trimmed, a reserve promoted onto
// the bench, someone new in the starting 13, positional reshuffles, a
// starter dropping to the bench, a player called in from outside the
// original 22. When the starting side or bench changes, the full team grid
// leads the body so the app highlights who moved. Reasons (suspended,
// injured) come only from our own data — the `reasons` map, built from
// Player statuses and the Finals Injury Watch — never invented; with no
// reason on file the sentence just names who came in for whom.
//
// Still returns null (held back, with an admin alert) only when the lists
// can't be compared at all: no INITIAL list on file, or one that isn't a
// structured list.
export function generateTwentyFourHourBody(
  side: Pick<AnalyzedSide, "starters" | "interchange" | "reserves" | "matchedTeamShortName" | "initialBody">,
  opponentShortName: string,
  kickoffAt: Date,
  reasons: Map<string, string> = new Map()
): TwentyFourHourResult {
  if (!side.initialBody) return { body: null, reason: "no INITIAL list on file to diff against" };
  const initial = parseStoredBody(side.initialBody);
  if (!initial) return { body: null, reason: "INITIAL body isn't a structured list" };

  const lower = (s: string) => s.toLowerCase();
  const initialStarterIdx = new Map(initial.starters.map((n, i) => [lower(n), i]));
  const initialBench = new Set(initial.interchange.map(lower));
  const initialReserves = new Set(initial.reserves.map(lower));
  const inInitial = (n: string) => initialStarterIdx.has(lower(n)) || initialBench.has(lower(n)) || initialReserves.has(lower(n));

  const currentStarterIdx = new Map(side.starters.map((p, i) => [lower(p.name), i]));
  const currentBench = new Set(side.interchange.map((p) => lower(p.name)));
  const currentNames = new Set([...side.starters, ...side.interchange, ...side.reserves].map((p) => lower(p.name)));

  const sentences: string[] = [];
  let lineupChanged = false;

  // Starting 13, slot by slot.
  side.starters.forEach((p, i) => {
    const before = initial.starters[i];
    if (before && lower(before) === lower(p.name)) return;
    lineupChanged = true;
    const position = STARTING_POSITIONS[i] ?? "in the starting side";
    const at = STARTING_POSITIONS[i] ? `at ${position}` : position;

    if (initialStarterIdx.has(lower(p.name))) {
      sentences.push(`${p.name} moves to ${position}.`);
      return;
    }
    let sentence = `${p.name} ${inInitial(p.name) ? "starts" : "is called into the side and starts"} ${at}`;
    if (before && !currentStarterIdx.has(lower(before))) {
      if (!currentNames.has(lower(before))) sentence += ` in place of ${describeOut(before, reasons)}`;
      else if (currentBench.has(lower(before))) sentence += `, with ${before} dropping to the bench`;
      else sentence += `, with ${before} dropping to the reserves`;
    }
    sentences.push(`${sentence}.`);
  });

  // Bench arrivals not already explained above (a starter dropping to the
  // bench is covered by its own sentence).
  for (const p of side.interchange) {
    const n = lower(p.name);
    if (initialBench.has(n) || initialStarterIdx.has(n)) continue;
    if (initialReserves.has(n)) {
      // Routine — the usual prose-only update, no grid needed.
      sentences.push(`${p.name} is promoted from the reserves onto the bench.`);
    } else {
      lineupChanged = true;
      sentences.push(`${p.name} is called into the squad on the bench.`);
    }
  }

  const omitted = computeOmitted({ starters: side.starters, interchange: side.interchange, reserves: side.reserves } as ParsedTeamSheet, side.initialBody);

  const dayLabel = kickoffAt.toLocaleDateString("en-AU", { weekday: "long", timeZone: "Australia/Sydney" });
  const trimClause = `as the ${side.matchedTeamShortName} trim their squad ahead of ${dayLabel}'s clash with the ${opponentShortName}`;
  const remaining = side.reserves.map((p) => p.name);
  let reserveSentence: string;
  if (remaining.length === 0) reserveSentence = `No reserves remain ${trimClause}.`;
  else if (remaining.length === 1) reserveSentence = `${remaining[0]} remains the one reserve ${trimClause}.`;
  else reserveSentence = `${remaining.join(" and ")} remain the ${remaining.length === 2 ? "two" : remaining.length} reserves ${trimClause}.`;

  const parts: string[] = [];
  // A starting-side change (or a call-up from outside the 22) gets the full
  // grid first, so the app can highlight who moved.
  if (lineupChanged) {
    let grid = `${playersToText(side.starters)}. Bench: ${playersToText(side.interchange)}.`;
    if (side.reserves.length > 0) grid += ` Reserves: ${playersToText(side.reserves)}.`;
    parts.push(grid);
  }
  if (omitted.names.length > 0) parts.push(`Omitted from the ${omitted.initialSquadSize} — ${omitted.names.join(", ")}.`);
  parts.push(...sentences, reserveSentence);
  return { body: parts.join(" ") };
}

export interface AnalyzedSide {
  rawTeamName: string;
  matchedTeamId: string | null;
  matchedTeamName: string | null;
  matchedTeamShortName: string | null;
  matchedGameId: string | null;
  starters: ParsedPlayer[];
  interchange: ParsedPlayer[];
  reserves: ParsedPlayer[];
  shapeWarnings: string[];
  suggestedStage: Stage;
  generatedBody: string;
  // The team's stored INITIAL body text, when one exists — lets a caller
  // (lib/lateMailPoller.ts's 24hr auto-prose generator) diff against the
  // actual original squad without a second DB round-trip.
  initialBody: string | null;
}

export interface AnalyzedMatch {
  matchLabel: string;
  home: AnalyzedSide;
  away: AnalyzedSide;
}

// Matches every scraped match against real Team/Game rows, diffs against
// each side's INITIAL list to derive the "Omitted from the NN" sentence,
// and generates the ready-to-publish body — everything routes/adminLateMail.ts
// used to do inline. Read-only: never writes anything itself.
export async function analyzeLateMail(lateMail: ParsedLateMail): Promise<AnalyzedMatch[]> {
  const teams = await prisma.team.findMany();
  function matchTeam(rawName: string) {
    const needle = rawName.trim().toLowerCase();
    return teams.find((t) => t.shortName.toLowerCase() === needle || t.name.toLowerCase() === needle) ?? null;
  }

  return Promise.all(
    lateMail.matches.map(async (m) => {
      const homeTeam = matchTeam(m.homeTeam.teamName);
      const awayTeam = matchTeam(m.awayTeam.teamName);

      const game =
        homeTeam && awayTeam
          ? await prisma.game.findFirst({
              where: {
                OR: [
                  { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id },
                  { homeTeamId: awayTeam.id, awayTeamId: homeTeam.id },
                ],
              },
              orderBy: { kickoffAt: "desc" },
            })
          : null;

      const [homeInitial, awayInitial] = game
        ? await Promise.all([
            homeTeam
              ? prisma.event.findFirst({
                  where: { gameId: game.id, teamId: homeTeam.id, type: "LINEUP_CHANGE", teamListStage: "INITIAL" },
                })
              : null,
            awayTeam
              ? prisma.event.findFirst({
                  where: { gameId: game.id, teamId: awayTeam.id, type: "LINEUP_CHANGE", teamListStage: "INITIAL" },
                })
              : null,
          ])
        : [null, null];

      const homeOmitted = computeOmitted(m.homeTeam, homeInitial?.body);
      const awayOmitted = computeOmitted(m.awayTeam, awayInitial?.body);
      const stage = game ? suggestStage(game.kickoffAt) : "INITIAL";

      return {
        matchLabel: m.matchLabel,
        home: {
          rawTeamName: m.homeTeam.teamName,
          matchedTeamId: homeTeam?.id ?? null,
          matchedTeamName: homeTeam?.name ?? null,
          matchedTeamShortName: homeTeam?.shortName ?? null,
          matchedGameId: game?.id ?? null,
          starters: m.homeTeam.starters,
          interchange: m.homeTeam.interchange,
          reserves: m.homeTeam.reserves,
          shapeWarnings: shapeWarnings(stage, m.homeTeam),
          suggestedStage: stage,
          generatedBody: buildBody(m.homeTeam, homeOmitted),
          initialBody: homeInitial?.body ?? null,
        },
        away: {
          rawTeamName: m.awayTeam.teamName,
          matchedTeamId: awayTeam?.id ?? null,
          matchedTeamName: awayTeam?.name ?? null,
          matchedTeamShortName: awayTeam?.shortName ?? null,
          matchedGameId: game?.id ?? null,
          starters: m.awayTeam.starters,
          interchange: m.awayTeam.interchange,
          reserves: m.awayTeam.reserves,
          shapeWarnings: shapeWarnings(stage, m.awayTeam),
          suggestedStage: stage,
          generatedBody: buildBody(m.awayTeam, awayOmitted),
          initialBody: awayInitial?.body ?? null,
        },
      };
    })
  );
}
