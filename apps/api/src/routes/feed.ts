import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/feed — the home page's data source: GENERAL_NEWS + TRANSFER
// events, newest first. TRANSFER is included alongside GENERAL_NEWS (not
// INJURY/LINEUP_CHANGE/NEWS, which stay team-page-only) specifically so
// signings are "Top" feed material and the Home page's Signing News chip
// (see HomePage.tsx) has real content to filter to — a signing is
// league-interest news even though it's tagged to one club. SOCIAL_POST
// events have their own dedicated destination (see routes/social.ts) rather
// than being interleaved here. A reader of the single Event table alongside
// team pages, game pages, the Social section, and the alert pipeline (see
// schema.prisma design notes).
router.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    where: { type: { in: ["GENERAL_NEWS", "TRANSFER"] } },
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
