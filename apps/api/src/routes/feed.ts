import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/feed — the home page's data source: GENERAL_NEWS events only,
// newest first. This is a clean news feed, not a mixed one — SOCIAL_POST
// events have their own dedicated destination (see routes/social.ts) rather
// than being interleaved here, and team-specific events (injuries, lineup
// changes, news, transfers) already have a home on their team/game page. A
// reader of the single Event table alongside team pages, game pages, the
// Social section, and the alert pipeline (see schema.prisma design notes).
router.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { type: "GENERAL_NEWS" },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      team: { select: { id: true, name: true, shortName: true, slug: true } },
      player: { select: { id: true, name: true, slug: true } },
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
  res.json(events);
});

export default router;
