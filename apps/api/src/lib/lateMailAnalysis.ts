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
function computeOmitted(sheet: ParsedTeamSheet, initialBody: string | undefined): { names: string[]; initialSquadSize: number } {
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
        },
      };
    })
  );
}
