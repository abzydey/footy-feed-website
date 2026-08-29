import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/social — the Social directory: every SOCIAL_POST event app-wide,
// newest first. A team-scoped view (teamId match) lives on the team page,
// and a game-scoped view (gameId match) lives on the game page — see
// routes/teams.ts and routes/games.ts. Same Event table, three filtered
// reads, no new schema.
router.get("/", async (_req, res) => {
  const posts = await prisma.event.findMany({
    where: { type: "SOCIAL_POST" },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      team: { select: { id: true, name: true, shortName: true, slug: true } },
      game: {
        select: {
          id: true,
          round: true,
          homeTeam: { select: { shortName: true, slug: true } },
          awayTeam: { select: { shortName: true, slug: true } },
        },
      },
    },
  });
  res.json(posts);
});

export default router;
