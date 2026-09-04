import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";
import { fetchLateMail, findLatestLateMailUrl, ParsedPlayer, ParsedTeamSheet } from "../lib/lateMailParser";

const router = Router();
router.use(requireAdmin);

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
function suggestStage(kickoffAt: Date): "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL" {
  const hrs = hoursUntil(kickoffAt);
  if (hrs > 36) return "INITIAL";
  if (hrs < 3) return "FINAL";
  return "TWENTY_FOUR_HOUR";
}

const parseSchema = z.object({ url: z.string().url().optional() });

// POST /api/admin/late-mail/parse — fetches + parses NRL.com's Late Mail
// page (see lib/lateMailParser.ts) and returns structured data for review.
// Never writes anything: publishing a team's list is a separate, explicit
// POST /api/admin/events call the admin panel makes per team after review,
// reusing the exact same endpoint every other team-list entry already goes
// through — this route has no side effects of its own.
router.post("/parse", async (req, res) => {
  const parsed = parseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const url = parsed.data.url ?? (await findLatestLateMailUrl().catch(() => null));
  if (!url) {
    return res.status(502).json({ error: "Couldn't find a current Late Mail article on nrl.com/news/ — pass a url explicitly." });
  }

  let lateMail;
  try {
    lateMail = await fetchLateMail(url);
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch/parse ${url}: ${err instanceof Error ? err.message : err}` });
  }

  const teams = await prisma.team.findMany();
  function matchTeam(rawName: string) {
    const needle = rawName.trim().toLowerCase();
    return teams.find((t) => t.shortName.toLowerCase() === needle || t.name.toLowerCase() === needle) ?? null;
  }

  const matches = await Promise.all(
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

      return {
        matchLabel: m.matchLabel,
        home: {
          rawTeamName: m.homeTeam.teamName,
          matchedTeamId: homeTeam?.id ?? null,
          matchedTeamName: homeTeam?.name ?? null,
          matchedGameId: game?.id ?? null,
          starters: m.homeTeam.starters,
          interchange: m.homeTeam.interchange,
          reserves: m.homeTeam.reserves,
          reserveWarning: m.homeTeam.reserveWarning,
          suggestedStage: game ? suggestStage(game.kickoffAt) : "INITIAL",
          generatedBody: buildBody(m.homeTeam, homeOmitted),
        },
        away: {
          rawTeamName: m.awayTeam.teamName,
          matchedTeamId: awayTeam?.id ?? null,
          matchedTeamName: awayTeam?.name ?? null,
          matchedGameId: game?.id ?? null,
          starters: m.awayTeam.starters,
          interchange: m.awayTeam.interchange,
          reserves: m.awayTeam.reserves,
          reserveWarning: m.awayTeam.reserveWarning,
          suggestedStage: game ? suggestStage(game.kickoffAt) : "INITIAL",
          generatedBody: buildBody(m.awayTeam, awayOmitted),
        },
      };
    })
  );

  res.json({ round: lateMail.round, sourceUrl: lateMail.sourceUrl, narrative: lateMail.narrative, matches });
});

export default router;
