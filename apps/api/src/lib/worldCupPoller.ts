import { GameStatus, Prisma, WorldCupMatch } from "@prisma/client";

import { prisma } from "./prisma";
import { sendAdminAlert } from "./adminAlert";
import { syncWorldCupTeamLists } from "./worldCupTeamLists";
import { fetchMatchCentre, parseTrySummaries } from "./matchCentreParser";

// Keeps the men's Rugby League World Cup fixtures and results in sync with
// the official draw page. That page (a Next.js site) embeds every game —
// men's, women's and wheelchair — as JSON records in the HTML; men's games
// are the ones whose matchCentreUrl sits under /draw/mens/. Each record
// carries the official gameId, start time (UTC), venue, round, pool
// ("group" 1 = Pool A, 2 = Pool B), both teams, and its state; semi-final
// and final teams read "TBA" until they're decided, so re-syncing picks
// them up as well as kickoff changes. Live scores come from NRL.com's
// draw data instead (syncLiveScores) — the official site doesn't carry them.

const DRAW_URL = "https://www.rlwc2026.com/draws-and-pools";
const SITE = "https://www.rlwc2026.com";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36";

const IDLE_INTERVAL_MS = 6 * 60 * 60 * 1000; // nothing on: four times a day
const LIVE_INTERVAL_MS = 5 * 60 * 1000; // around a game: every 5 minutes
const IN_PLAY_INTERVAL_MS = 60 * 1000; // a game being played: every minute (score, clock, tries)
const HOURLY_MS = 60 * 60 * 1000; // a week with games: team lists
const FINAL_LIST_WINDOW_MS = 3.5 * 60 * 60 * 1000; // final lists, then kickoff
const GAME_WEEK_MS = 8 * 86_400_000;
// The 24-hour team update: checked every 10 minutes from 27 to 21 hours out.
const DAY_BEFORE_FROM_MS = 27 * 60 * 60 * 1000;
const DAY_BEFORE_TO_MS = 21 * 60 * 60 * 1000;
const DAY_BEFORE_INTERVAL_MS = 10 * 60 * 1000;
const WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;

interface DrawTeam {
  teamName: string;
  teamAbbr: string;
  isHomeTeam: boolean;
  score?: number | string | null;
  teamScore?: number | string | null;
  points?: number | string | null;
}

interface DrawGame {
  gameId: string;
  roundName: string;
  group: number | null;
  startTime: string;
  venueName: string;
  city: string;
  gameStateName: string;
  teams: DrawTeam[];
  matchCentreUrl: string | null;
  ticketUrl: string | null;
}

// Pulls each {"gameId": …} record out of the page's embedded data by
// brace-matching — the data is a JS string in the page, so its quotes are
// escaped and it can't be read as one JSON document.
export function extractDrawGames(html: string): DrawGame[] {
  const s = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const games = new Map<string, DrawGame>();
  let i = 0;
  while ((i = s.indexOf('{"gameId":"', i)) !== -1) {
    let depth = 0;
    let inStr = false;
    let j = i;
    for (; j < s.length; j++) {
      const c = s[j];
      if (inStr) {
        if (c === "\\") j++;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) break;
    }
    try {
      const g = JSON.parse(s.slice(i, j + 1)) as DrawGame;
      games.set(g.gameId, g);
    } catch {
      // a partial record — skip it
    }
    i = j + 1;
  }
  return [...games.values()].filter((g) => (g.matchCentreUrl ?? "").includes("/draw/mens/"));
}

function scoreOf(team: DrawTeam | undefined): number | null {
  const v = team?.score ?? team?.teamScore ?? team?.points;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function statusOf(state: string): GameStatus {
  if (/pre/i.test(state)) return "SCHEDULED";
  if (/full|post|final|complete|ended/i.test(state)) return "FULL_TIME";
  return "LIVE";
}

// The official site shows "Tonga" in its draw even though the data names
// the side "Tonga XIII" — display what the site displays.
const cleanName = (name: string) => name.replace(/\s+XIII$/i, "");

let lastProblem = "";
function problem(message: string) {
  if (message === lastProblem) return;
  lastProblem = message;
  if (!message) return;
  console.error(`[worldCupPoller] ${message}`);
  sendAdminAlert("⚠️ World Cup draw isn't syncing", message).catch(() => {});
}

export async function syncWorldCup(): Promise<void> {
  let games: DrawGame[];
  try {
    const res = await fetch(DRAW_URL, { headers: { "User-Agent": BROWSER_USER_AGENT } });
    if (!res.ok) throw new Error(`draw page returned ${res.status}`);
    games = extractDrawGames(await res.text());
  } catch (err) {
    problem(`Couldn't read the official draw: ${(err as Error).message}`);
    return;
  }
  if (games.length === 0) {
    problem("The official draw page loaded but no men's games were found in it — its layout may have changed.");
    return;
  }

  const existing = new Map((await prisma.worldCupMatch.findMany()).map((m) => [m.id, m]));
  for (const g of games) {
    const home = g.teams.find((t) => t.isHomeTeam) ?? g.teams[0];
    const away = g.teams.find((t) => !t.isHomeTeam) ?? g.teams[1];
    const prev = existing.get(g.gameId);
    const homeScore = scoreOf(home);
    const awayScore = scoreOf(away);
    // Scores and status come from NRL.com (syncLiveScores below) — the
    // official draw page doesn't carry scores. Only take them from here if
    // it ever does, and never blank out a score NRL.com already set.
    const scoreFields =
      homeScore != null && awayScore != null
        ? { homeScore, awayScore, status: statusOf(g.gameStateName) }
        : prev
          ? { homeScore: prev.homeScore, awayScore: prev.awayScore, status: prev.status }
          : { homeScore: null, awayScore: null, status: "SCHEDULED" as GameStatus };
    const data = {
      roundName: g.roundName,
      pool: g.group === 1 ? "A" : g.group === 2 ? "B" : null,
      kickoffAt: new Date(g.startTime),
      venue: g.venueName,
      city: g.city,
      homeName: cleanName(home?.teamName ?? "TBA"),
      homeAbbr: home?.teamAbbr ?? "TBA",
      awayName: cleanName(away?.teamName ?? "TBA"),
      awayAbbr: away?.teamAbbr ?? "TBA",
      ...scoreFields,
      matchCentreUrl: g.matchCentreUrl ? `${SITE}${g.matchCentreUrl}` : null,
      ticketUrl: g.ticketUrl,
    };
    const same =
      prev &&
      (Object.keys(data) as (keyof typeof data)[]).every((k) =>
        data[k] instanceof Date ? (prev[k] as Date).getTime() === (data[k] as Date).getTime() : prev[k] === data[k]
      );
    if (same) continue; // unchanged — no write
    await prisma.worldCupMatch.upsert({ where: { id: g.gameId }, create: { id: g.gameId, ...data }, update: data });
  }
  problem(""); // healthy again
}

// NRL.com runs the men's World Cup as competition 131, in exactly the same
// draw format as NRL games: matchMode Pre / Live / Post, with each team's
// score once it's started — the source the club live scores already use.
// Rounds there are numbered 1–5 (Rounds 1–3, Semi Final, Final); fixtures
// are matched to ours by kickoff time.
const NRL_WC_COMPETITION = 131;
const NRL_WC_ROUND: Record<string, number> = { "Round 1": 1, "Round 2": 2, "Round 3": 3, "Semi Final": 4, Final: 5 };

interface NrlFixture {
  matchMode: string;
  matchCentreUrl?: string;
  matchState?: string;
  clock?: { kickOffTimeLong?: string };
  homeTeam?: { score?: number };
  awayTeam?: { score?: number };
}

export async function syncLiveScores(): Promise<void> {
  const now = Date.now();
  const due = await prisma.worldCupMatch.findMany({
    where: {
      status: { not: "FULL_TIME" },
      kickoffAt: { gte: new Date(now - WINDOW_AFTER_MS), lte: new Date(now + 15 * 60 * 1000) },
    },
  });
  if (due.length === 0) return;

  const rounds = [...new Set(due.map((m) => NRL_WC_ROUND[m.roundName]).filter(Boolean))];
  const fixtures: NrlFixture[] = [];
  for (const round of rounds) {
    try {
      const res = await fetch(
        `https://www.nrl.com/draw/data?competition=${NRL_WC_COMPETITION}&season=${new Date(due[0].kickoffAt).getUTCFullYear()}&round=${round}`,
        { headers: { "User-Agent": BROWSER_USER_AGENT } }
      );
      if (!res.ok) throw new Error(`NRL.com returned ${res.status}`);
      fixtures.push(...(((await res.json()) as { fixtures?: NrlFixture[] }).fixtures ?? []));
    } catch (err) {
      problem(`Couldn't read World Cup live scores from NRL.com: ${(err as Error).message}`);
      return;
    }
  }

  for (const m of due) {
    const f = fixtures.find((x) => x.clock?.kickOffTimeLong && new Date(x.clock.kickOffTimeLong).getTime() === m.kickoffAt.getTime());
    if (!f) {
      problem(`${m.homeName} v ${m.awayName} isn't in NRL.com's World Cup draw at its kickoff time — no live score for it.`);
      continue;
    }
    if (/^pre/i.test(f.matchMode)) continue; // not started
    // The game's own NRL.com match centre, same page and format as NRL
    // games: score, live clock and every try scorer with the minute. The
    // draw list above only has the score, and lags it.
    if (f.matchCentreUrl && (await syncFromMatchCentre(m, `https://www.nrl.com${f.matchCentreUrl}`))) continue;
    const homeScore = f.homeTeam?.score ?? null;
    const awayScore = f.awayTeam?.score ?? null;
    if (homeScore == null || awayScore == null) continue;
    const status: GameStatus = /^post/i.test(f.matchMode) ? "FULL_TIME" : "LIVE";
    if (m.homeScore === homeScore && m.awayScore === awayScore && m.status === status) continue;
    await prisma.worldCupMatch.update({ where: { id: m.id }, data: { homeScore, awayScore, status } });
    console.log(`[worldCupPoller] ${status === "FULL_TIME" ? "FULL TIME" : "LIVE"}: ${m.homeName} ${homeScore}-${awayScore} ${m.awayName}`);
  }
}

export interface WorldCupTry {
  side: "HOME" | "AWAY";
  scorer: string;
  minute: number;
}

// Score, clock and tries from a World Cup game's NRL.com match centre.
// Returns false when the page couldn't be read, so the caller falls back to
// the draw list's score. The try list is replaced whole each time, so a
// try NRL.com drops (bunker overturn) drops here too.
export async function syncFromMatchCentre(m: WorldCupMatch, url: string): Promise<boolean> {
  let mc;
  try {
    mc = await fetchMatchCentre(url);
  } catch (err) {
    console.warn(`[worldCupPoller] match centre unreadable for ${m.homeName} v ${m.awayName}:`, (err as Error).message);
    return false;
  }
  if (/^pre/i.test(mc.matchMode)) return true;
  const status: GameStatus = /^post/i.test(mc.matchMode) ? "FULL_TIME" : "LIVE";
  const liveClock = status === "FULL_TIME" ? null : mc.matchState === "HalfTime" ? "HT" : `${Math.floor(mc.gameSeconds / 60)}'`;
  const tries: WorldCupTry[] = [
    ...parseTrySummaries(mc.homeTries).map((t) => ({ side: "HOME" as const, ...t })),
    ...parseTrySummaries(mc.awayTries).map((t) => ({ side: "AWAY" as const, ...t })),
  ];
  const same =
    m.homeScore === mc.homeScore && m.awayScore === mc.awayScore && m.status === status && m.liveClock === liveClock &&
    JSON.stringify(m.tries ?? []) === JSON.stringify(tries);
  if (same) return true;
  await prisma.worldCupMatch.update({
    where: { id: m.id },
    data: { homeScore: mc.homeScore, awayScore: mc.awayScore, status, liveClock, tries: tries as unknown as Prisma.InputJsonValue },
  });
  if (m.homeScore !== mc.homeScore || m.awayScore !== mc.awayScore || m.status !== status) {
    console.log(`[worldCupPoller] ${status === "FULL_TIME" ? "FULL TIME" : "LIVE"}: ${m.homeName} ${mc.homeScore}-${mc.awayScore} ${m.awayName}`);
  }
  return true;
}

// How soon to check again, looking at every upcoming game (not just the
// next one — a round's games overlap, so one game's 24-hour update often
// lands while another is about to kick off). Team lists follow the NRL's
// rhythm: initial list early in the week, a 24-hour update the day before,
// and the final list about 1.5 hours before kickoff.
//   - every minute while a game is being played (score, clock, tries)
//   - every 5 minutes from 3½ hours before a kickoff (final team list)
//   - every 10 minutes from 27 to 21 hours before a kickoff (24-hour update)
//   - hourly otherwise in a week with games (initial lists)
//   - a few times a day when nothing's on, waking in time for the next window
async function nextCheckInMs(): Promise<number> {
  const now = Date.now();
  const pending = await prisma.worldCupMatch.findMany({
    where: { status: { not: "FULL_TIME" }, kickoffAt: { gte: new Date(now - WINDOW_AFTER_MS) } },
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });
  let wait = IDLE_INTERVAL_MS;
  for (const m of pending) {
    const until = m.kickoffAt.getTime() - now;
    if (until <= 0) return IN_PLAY_INTERVAL_MS; // kicked off and not yet full time
    // Before kickoff: every 5 minutes for the final list, and wake right at
    // kickoff to start the every-minute live checks.
    if (until <= FINAL_LIST_WINDOW_MS) wait = Math.min(wait, LIVE_INTERVAL_MS, until);
    if (until <= DAY_BEFORE_FROM_MS && until >= DAY_BEFORE_TO_MS) wait = Math.min(wait, DAY_BEFORE_INTERVAL_MS);
    if (until > DAY_BEFORE_FROM_MS) wait = Math.min(wait, until - DAY_BEFORE_FROM_MS);
    if (until <= GAME_WEEK_MS) wait = Math.min(wait, HOURLY_MS);
    else wait = Math.min(wait, until - GAME_WEEK_MS);
    if (until > FINAL_LIST_WINDOW_MS) wait = Math.min(wait, until - FINAL_LIST_WINDOW_MS);
  }
  return wait;
}

export function startWorldCupPolling(): void {
  const tick = async () => {
    await syncWorldCup().catch((err) => problem(`Sync failed: ${(err as Error).message}`));
    await syncLiveScores().catch((err) => problem(`Live scores failed: ${(err as Error).message}`));
    await syncWorldCupTeamLists().catch((err) => console.error("[worldCupTeamLists] sync failed:", err));
    const wait = await nextCheckInMs().catch(() => HOURLY_MS);
    setTimeout(tick, Math.max(60_000, wait));
  };
  tick();
}
