import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/teams — list all teams, for the team directory / nav.
router.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true },
  });
  res.json(teams);
});

// GET /api/teams/:slug — the team brief page: roster + most recent lineup
// change + recent news, all in one call.
router.get("/:slug", async (req, res) => {
  const team = await prisma.team.findUnique({ where: { slug: req.params.slug } });
  if (!team) return res.status(404).json({ error: "Team not found" });

  const [players, latestLineupChange, recentEvents] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: { name: "asc" },
    }),
    prisma.event.findFirst({
      where: { teamId: team.id, type: "LINEUP_CHANGE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: {
        OR: [{ teamId: team.id }, { player: { teamId: team.id } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { player: { select: { id: true, name: true, slug: true } } },
    }),
  ]);

  res.json({ team, players, latestLineupChange, recentEvents });
});

export default router;
