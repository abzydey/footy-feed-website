import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;
const STAGES = ["INITIAL", "TWENTY_FOUR_HOUR", "FINAL"] as const;

// GET /api/games — fixture directory, soonest first. Optional ?round= filters
// to just that round (used by the Games page's round navigation — see
// GET /rounds below for the list of rounds to navigate between).
router.get("/", async (req, res) => {
  const round = typeof req.query.round === "string" ? req.query.round : undefined;
  const games = await prisma.game.findMany({
    where: round ? { round } : undefined,
    orderBy: { kickoffAt: "asc" },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });
  res.json(games);
});

// GET /api/games/rounds — every round that has at least one fixture,
// chronologically ordered by that round's earliest kickoff (not sorted as
// text — "Round 10" would otherwise sort before "Round 9", and this also
// has to work for non-numbered rounds like "Grand Final"). Powers the
// Games page's previous/next round navigation.
router.get("/rounds", async (_req, res) => {
  const games = await prisma.game.findMany({ select: { round: true, kickoffAt: true } });
  const earliestByRound = new Map<string, Date>();
  for (const g of games) {
    const existing = earliestByRound.get(g.round);
    if (!existing || g.kickoffAt < existing) earliestByRound.set(g.round, g.kickoffAt);
  }
  const rounds = [...earliestByRound.entries()].sort((a, b) => a[1].getTime() - b[1].getTime()).map(([round]) => round);
  res.json(rounds);
});

// GET /api/games/current-round — every game in "the current round" (the
// round of the next upcoming kickoff, or the most recently played round once
// the season's fixtures are all done) with each side's full lineup-stage
// history, for the standalone Team Lists page — same per-team/per-stage
// shape as GET /:id below, just for every game in the round at once instead
// of one match at a time. Registered before /:id so "current-round" isn't
// swallowed as a game id.
router.get("/current-round", async (_req, res) => {
  const now = new Date();
  const nextGame = await prisma.game.findFirst({
    where: { kickoffAt: { gt: now } },
    orderBy: { kickoffAt: "asc" },
  });
  const anchorGame = nextGame ?? (await prisma.game.findFirst({ orderBy: { kickoffAt: "desc" } }));
  if (!anchorGame) return res.json({ round: null, games: [] });

  const round = anchorGame.round;
  const games = await prisma.game.findMany({
    where: { round },
    orderBy: { kickoffAt: "asc" },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });

  const lineupEvents = await prisma.event.findMany({
    where: { gameId: { in: games.map((g) => g.id) }, type: "LINEUP_CHANGE" },
    orderBy: { createdAt: "desc" },
  });

  function stageMapFor(gameId: string, teamId: string) {
    return Object.fromEntries(
      STAGES.map((stage) => [
        stage,
        lineupEvents.find((e) => e.gameId === gameId && e.teamId === teamId && e.teamListStage === stage) ?? null,
      ])
    );
  }

  const result = games.map((game) => ({
    game,
    homeTeamLineup: stageMapFor(game.id, game.homeTeamId),
    awayTeamLineup: stageMapFor(game.id, game.awayTeamId),
  }));

  res.json({ round, games: result });
});

// GET /api/games/:id — the game page: each team's full INITIAL/24HR/FINAL
// team-list history for this match (not just "the latest one") + the rest
// of the match's news + this game's Social section. Each side progresses
// through its three checkpoints independently, so this is keyed per team,
// per stage — the frontend fills in a "pending, expected around <time>"
// placeholder for any stage that hasn't been logged yet (see
// TeamListCard.tsx), computed from this game's own kickoffAt rather than
// something the admin has to set per game.
router.get("/:id", async (req, res) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });
  if (!game) return res.status(404).json({ error: "Game not found" });

  const lineupEvents = await prisma.event.findMany({
    where: { gameId: game.id, type: "LINEUP_CHANGE" },
    orderBy: { createdAt: "desc" },
  });

  function stageMapFor(teamId: string) {
    return Object.fromEntries(
      STAGES.map((stage) => [stage, lineupEvents.find((e) => e.teamId === teamId && e.teamListStage === stage) ?? null])
    );
  }
  const homeTeamLineup = stageMapFor(game.homeTeamId);
  const awayTeamLineup = stageMapFor(game.awayTeamId);

  const tries = await prisma.try.findMany({ where: { gameId: game.id }, orderBy: { minute: "asc" } });
  const homeTries = tries.filter((t) => t.teamId === game.homeTeamId);
  const awayTries = tries.filter((t) => t.teamId === game.awayTeamId);

  // LINEUP_CHANGE events are now fully owned by the per-stage cards above,
  // not duplicated in the general news list below (previously only the two
  // "current" ones were excluded; now all of them are, across every stage).
  const recentEvents = await prisma.event.findMany({
    where: { gameId: game.id, type: { notIn: ["SOCIAL_POST", "LINEUP_CHANGE"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      team: { select: { id: true, name: true, slug: true } },
      player: { select: { id: true, name: true, slug: true } },
    },
  });

  // This game's Social section — SOCIAL_POST events tied to this match via gameId.
  const socialPosts = await prisma.event.findMany({
    where: { gameId: game.id, type: "SOCIAL_POST" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({ game, homeTeamLineup, awayTeamLineup, recentEvents, socialPosts, homeTries, awayTries });
});

export default router;
