import { GameStatus } from "@prisma/client";

import { prisma } from "./prisma";
import { sendAdminAlert } from "./adminAlert";

// Keeps the men's Rugby League World Cup fixtures and results in sync with
// the official draw page. That page (a Next.js site) embeds every game —
// men's, women's and wheelchair — as JSON records in the HTML; men's games
// are the ones whose matchCentreUrl sits under /draw/mens/. Each record
// carries the official gameId, start time (UTC), venue, round, pool
// ("group" 1 = Pool A, 2 = Pool B), both teams, and its state; semi-final
// and final teams read "TBA" until they're decided, so re-syncing picks
// them up as well as scores and kickoff changes.

const DRAW_URL = "https://www.rlwc2026.com/draws-and-pools";
const SITE = "https://www.rlwc2026.com";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36";

const IDLE_INTERVAL_MS = 6 * 60 * 60 * 1000; // nothing on: four times a day
const LIVE_INTERVAL_MS = 5 * 60 * 1000; // a game in its window: every 5 minutes
const WINDOW_BEFORE_MS = 15 * 60 * 1000;
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

  for (const g of games) {
    const home = g.teams.find((t) => t.isHomeTeam) ?? g.teams[0];
    const away = g.teams.find((t) => !t.isHomeTeam) ?? g.teams[1];
    const status = statusOf(g.gameStateName);
    const homeScore = scoreOf(home);
    const awayScore = scoreOf(away);
    if (status === "FULL_TIME" && (homeScore == null || awayScore == null)) {
      problem(`${home?.teamName} v ${away?.teamName} is marked finished on the official site but no score was found in its data.`);
    }
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
      homeScore,
      awayScore,
      status,
      matchCentreUrl: g.matchCentreUrl ? `${SITE}${g.matchCentreUrl}` : null,
      ticketUrl: g.ticketUrl,
    };
    await prisma.worldCupMatch.upsert({ where: { id: g.gameId }, create: { id: g.gameId, ...data }, update: data });
  }
  problem(""); // healthy again
}

async function inGameWindow(): Promise<boolean> {
  const now = Date.now();
  const n = await prisma.worldCupMatch.count({
    where: {
      status: { not: "FULL_TIME" },
      kickoffAt: { gte: new Date(now - WINDOW_AFTER_MS), lte: new Date(now + WINDOW_BEFORE_MS) },
    },
  });
  return n > 0;
}

// Self-scheduling: every 5 minutes while a game is on (for live scores),
// otherwise a few times a day for draw changes and knockout teams.
export function startWorldCupPolling(): void {
  const tick = async () => {
    await syncWorldCup().catch((err) => problem(`Sync failed: ${(err as Error).message}`));
    const live = await inGameWindow().catch(() => false);
    setTimeout(tick, live ? LIVE_INTERVAL_MS : Math.min(IDLE_INTERVAL_MS, await msUntilNextWindow()));
  };
  tick();
}

// So the first live check lands at kickoff rather than up to 6 hours late.
async function msUntilNextWindow(): Promise<number> {
  const next = await prisma.worldCupMatch
    .findFirst({ where: { status: "SCHEDULED", kickoffAt: { gt: new Date() } }, orderBy: { kickoffAt: "asc" } })
    .catch(() => null);
  if (!next) return IDLE_INTERVAL_MS;
  return Math.max(60_000, next.kickoffAt.getTime() - WINDOW_BEFORE_MS - Date.now());
}
