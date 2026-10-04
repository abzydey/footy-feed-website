import { TeamListStage, WorldCupMatch } from "@prisma/client";

import { prisma } from "./prisma";
import { sendAdminAlert } from "./adminAlert";
import { buildBody, computeOmitted, generateTwentyFourHourBody, suggestStage } from "./lateMailAnalysis";
import { ParsedPlayer, ParsedTeamSheet } from "./lateMailParser";

// World Cup team lists, automated the same way as the NRL's (lateMailPoller)
// with the same three stages and the same written format — but the source
// is each game's own page on rlwc2026.com, not one weekly article. Each
// page embeds an "initialTeamList" block per side with Backs / Forwards /
// Interchange / Reserves sections, empty ("Team lists have not been
// announced yet") until the lists are named, plus a lineUpStatus.
//
// Stored as LINEUP_CHANGE events tagged worldCup, linked to the World Cup
// game and side (Event.worldCupMatchId / worldCupSide), so they appear in
// the feed and render with the same team-list card (grid, strikethrough,
// changed-player highlights). Never pushed as notifications — nobody follows
// nations (decided 2026-10-04).

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36";

type Side = "HOME" | "AWAY";

interface RawSection {
  key: string;
  players: Record<string, unknown>[];
}
interface RawSide {
  header?: { name?: string; abbr?: string };
  sections?: RawSection[];
  lineUpStatus?: string;
}

// The player records were empty when this was built (no lists named yet),
// so their field names couldn't be seen — this reads the common shapes and
// reports (rather than guesses) when a record can't be read.
function readPlayer(p: Record<string, unknown>, fallbackNumber: number): ParsedPlayer | null {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const first = str(p.firstName) ?? str(p.givenName);
  const last = str(p.lastName) ?? str(p.surname) ?? str(p.familyName);
  const name = str(p.name) ?? str(p.fullName) ?? str(p.playerName) ?? (first && last ? `${first} ${last}` : null);
  if (!name) return null;
  const numRaw = p.number ?? p.jerseyNumber ?? p.shirtNumber ?? p.playerNumber;
  const num = typeof numRaw === "string" ? Number(numRaw) : numRaw;
  return {
    number: typeof num === "number" && Number.isFinite(num) ? num : fallbackNumber,
    name,
    position: str(p.position) ?? str(p.positionName) ?? "",
  };
}

function readSide(raw: RawSide): { sheet: ParsedTeamSheet; unreadable: number; status: string } {
  const section = (key: string) => raw.sections?.find((s) => s.key === key)?.players ?? [];
  let unreadable = 0;
  let n = 0;
  const read = (list: Record<string, unknown>[]) =>
    list
      .map((p) => {
        n++;
        const player = readPlayer(p, n);
        if (!player) unreadable++;
        return player;
      })
      .filter((p): p is ParsedPlayer => p !== null);
  const starters = read([...section("backs"), ...section("forwards")]);
  const interchange = read(section("interchange"));
  const reserves = read(section("reserves"));
  return {
    sheet: { teamName: raw.header?.name ?? "", starters, interchange, reserves },
    unreadable,
    status: raw.lineUpStatus ?? "",
  };
}

// Finds the page's "initialTeamList" object (escaped JSON inside the page)
// by brace-matching from its key.
export function extractTeamList(html: string): { home: RawSide; away: RawSide } | null {
  const s = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const key = '"initialTeamList":';
  const at = s.indexOf(key);
  if (at === -1) return null;
  const start = at + key.length;
  let depth = 0;
  let inStr = false;
  for (let j = start; j < s.length; j++) {
    const c = s[j];
    if (inStr) {
      if (c === "\\") j++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try {
        const obj = JSON.parse(s.slice(start, j + 1));
        return obj.home && obj.away ? { home: obj.home, away: obj.away } : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const lastProblem = new Map<string, string>();
function problem(key: string, message: string) {
  if (lastProblem.get(key) === message) return;
  lastProblem.set(key, message);
  if (!message) return;
  console.error(`[worldCupTeamLists] ${message}`);
  sendAdminAlert("⚠️ World Cup team list needs you", message).catch(() => {});
}

function headline(nation: string, round: string, stage: TeamListStage): string {
  if (stage === "FINAL") return `${nation} Final Team List: World Cup ${round}`;
  if (stage === "TWENTY_FOUR_HOUR") return `24-hour team update: ${nation}`;
  return `${nation} World Cup ${round} team list`;
}

async function stored(matchId: string, side: Side) {
  const rows = await prisma.event.findMany({
    where: { worldCupMatchId: matchId, worldCupSide: side, type: "LINEUP_CHANGE" },
    orderBy: { createdAt: "asc" },
  });
  return {
    INITIAL: rows.find((r) => r.teamListStage === "INITIAL") ?? null,
    TWENTY_FOUR_HOUR: rows.find((r) => r.teamListStage === "TWENTY_FOUR_HOUR") ?? null,
    FINAL: rows.find((r) => r.teamListStage === "FINAL") ?? null,
  };
}

async function save(match: WorldCupMatch, side: Side, stage: TeamListStage, nation: string, body: string) {
  const existing = await prisma.event.findFirst({
    where: { worldCupMatchId: match.id, worldCupSide: side, type: "LINEUP_CHANGE", teamListStage: stage },
  });
  if (existing) {
    if (existing.body !== body) {
      await prisma.event.update({ where: { id: existing.id }, data: { body } });
      console.log(`[worldCupTeamLists] updated ${nation} ${stage}`);
    }
    return;
  }
  await prisma.event.create({
    data: {
      type: "LINEUP_CHANGE",
      teamListStage: stage,
      worldCup: true,
      worldCupMatchId: match.id,
      worldCupSide: side,
      headline: headline(nation, match.roundName, stage),
      body,
      createdBy: "world-cup-team-lists",
    },
  });
  console.log(`[worldCupTeamLists] published ${nation} ${stage}`);
  // Deliberately no notifyFollowersOfEvent — see the note at the top.
}

// The names in a stored body, in order — to tell whether the page's list
// has actually changed since the last stage.
const namesIn = (body: string | null | undefined) =>
  [...(body ?? "").matchAll(/\d{1,2}\.\s*([^,.]+?)(?=,|\.|$)/g)].map((m) => m[1].trim().toLowerCase()).join("|");
const namesOf = (sheet: ParsedTeamSheet) =>
  [...sheet.starters, ...sheet.interchange, ...sheet.reserves].map((p) => p.name.toLowerCase()).join("|");

async function processSide(match: WorldCupMatch, side: Side, raw: RawSide, opponent: string) {
  const key = `${match.id}|${side}`;
  const nation = side === "HOME" ? match.homeName : match.awayName;
  const { sheet, unreadable, status } = readSide(raw);
  const total = sheet.starters.length + sheet.interchange.length + sheet.reserves.length;
  if (total === 0 && unreadable === 0) return; // not named yet
  if (unreadable > 0) {
    problem(key, `${nation}'s list for ${match.roundName} v ${opponent} is on the official site, but ${unreadable} player(s) couldn't be read — the page's player format may have changed.`);
    return;
  }
  if (sheet.starters.length !== 13) {
    problem(key, `${nation}'s list for ${match.roundName} v ${opponent} has ${sheet.starters.length} starters (expected 13) — not published.`);
    return;
  }
  problem(key, "");

  const have = await stored(match.id, side);
  let stage = suggestStage(match.kickoffAt);
  // A first list that only appears close to kickoff is still the initial
  // one — there's nothing earlier to describe changes against.
  if (!have.INITIAL) stage = "INITIAL";

  if (stage === "INITIAL") {
    // Re-named before the 24-hour window: keep the initial list current.
    await save(match, side, "INITIAL", nation, buildBody(sheet, { names: [], initialSquadSize: 0 }));
    return;
  }

  const initialBody = have.INITIAL!.body;
  if (stage === "TWENTY_FOUR_HOUR") {
    if (namesOf(sheet) === namesIn(initialBody) && !have.TWENTY_FOUR_HOUR) return; // nothing new yet
    const result = generateTwentyFourHourBody(
      { starters: sheet.starters, interchange: sheet.interchange, reserves: sheet.reserves, matchedTeamShortName: nation, initialBody },
      opponent,
      match.kickoffAt
    );
    if (!result.body) {
      problem(key, `${nation}'s 24-hour update couldn't be written automatically: ${result.reason}`);
      return;
    }
    await save(match, side, "TWENTY_FOUR_HOUR", nation, result.body);
    return;
  }

  // Final window (under 3 hours to kickoff): publish once the list differs
  // from the last stage, or the site marks it confirmed.
  const previous = have.FINAL ?? have.TWENTY_FOUR_HOUR ?? have.INITIAL;
  const confirmed = status !== "" && !/unconfirmed/i.test(status);
  if (!have.FINAL && namesOf(sheet) === namesIn(previous?.body) && !confirmed) return;
  await save(match, side, "FINAL", nation, buildBody(sheet, computeOmitted(sheet, initialBody)));
}

// Checks every men's World Cup game kicking off in the next 8 days whose
// teams are known.
export async function syncWorldCupTeamLists(): Promise<void> {
  const now = Date.now();
  const matches = await prisma.worldCupMatch.findMany({
    where: {
      status: "SCHEDULED",
      kickoffAt: { gt: new Date(now), lte: new Date(now + 8 * 86_400_000) },
      NOT: [{ homeAbbr: "TBA" }, { awayAbbr: "TBA" }],
    },
    orderBy: { kickoffAt: "asc" },
  });
  for (const match of matches) {
    if (!match.matchCentreUrl) continue;
    let lists;
    try {
      const res = await fetch(match.matchCentreUrl, { headers: { "User-Agent": BROWSER_USER_AGENT } });
      if (!res.ok) throw new Error(`page returned ${res.status}`);
      lists = extractTeamList(await res.text());
    } catch (err) {
      problem(`${match.id}|page`, `Couldn't read ${match.homeName} v ${match.awayName}'s page: ${(err as Error).message}`);
      continue;
    }
    if (!lists) {
      problem(`${match.id}|page`, `${match.homeName} v ${match.awayName}'s page has no team list block any more — its layout may have changed.`);
      continue;
    }
    problem(`${match.id}|page`, "");
    await processSide(match, "HOME", lists.home, match.awayName);
    await processSide(match, "AWAY", lists.away, match.homeName);
  }
}
