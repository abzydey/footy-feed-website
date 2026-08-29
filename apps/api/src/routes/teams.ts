import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;
const STAGES = ["INITIAL", "TWENTY_FOUR_HOUR", "FINAL"] as const;

// GET /api/teams — list all teams, for the team directory / nav.
router.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: teamSelect,
  });
  res.json(teams);
});

// GET /api/teams/:slug — the team brief page: roster, this team's team-list
// stage tracker for whichever game it's currently mid-cycle on, recent news,
// and Social.
//
// The team-list section reads directly from the real LINEUP_CHANGE events
// the admin already enters per game/stage (same source and same
// INITIAL/24HR/FINAL stage-tracker shape as the Game page's TeamListCard —
// see routes/games.ts) rather than a second, separately-maintained
// representation. There's no standing "current squad" concept to duplicate:
// `currentGame` is just whichever game this team's most recent LINEUP_CHANGE
// event belongs to, so the section naturally follows whatever the admin is
// actively logging.
router.get("/:slug", async (req, res) => {
  const team = await prisma.team.findUnique({ where: { slug: req.params.slug } });
  if (!team) return res.status(404).json({ error: "Team not found" });

  const [players, latestLineupChange] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: { name: "asc" },
    }),
    prisma.event.findFirst({
      where: { teamId: team.id, type: "LINEUP_CHANGE" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let currentGame = null;
  let lineupStages = null;
  if (latestLineupChange?.gameId) {
    const game = await prisma.game.findUnique({
      where: { id: latestLineupChange.gameId },
      include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
    });
    if (game) {
      const lineupEvents = await prisma.event.findMany({
        where: { gameId: game.id, teamId: team.id, type: "LINEUP_CHANGE" },
      });
      lineupStages = Object.fromEntries(STAGES.map((stage) => [stage, lineupEvents.find((e) => e.teamListStage === stage) ?? null]));
      currentGame = game;
    }
  }

  // The team's most recent completed result, for the "Last: L 20-46 vs
  // Storm" line — queried independently of currentGame above (which tracks
  // whichever game has the latest LINEUP_CHANGE event, and stops being that
  // finished game as soon as the next round's team list is entered).
  const lastGame = await prisma.game.findFirst({
    where: {
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      homeScore: { not: null },
      awayScore: { not: null },
    },
    orderBy: { kickoffAt: "desc" },
    include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
  });

  // LINEUP_CHANGE events are fully owned by the stage tracker above now, not
  // duplicated in the general news list. Excludes SOCIAL_POST too — those
  // get their own Social section (see socialPosts below).
  const recentEvents = await prisma.event.findMany({
    where: {
      OR: [{ teamId: team.id }, { player: { teamId: team.id } }],
      type: { notIn: ["SOCIAL_POST", "LINEUP_CHANGE"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { player: { select: { id: true, name: true, slug: true } } },
  });

  // This team's Social section — SOCIAL_POST events tied directly to this
  // team via teamId (not via a player's team, unlike recentEvents above).
  const socialPosts = await prisma.event.findMany({
    where: { teamId: team.id, type: "SOCIAL_POST" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({ team, players, currentGame, lineupStages, lastGame, recentEvents, socialPosts });
});

export default router;
