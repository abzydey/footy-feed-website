import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/world-cup/matches — every men's World Cup game, in kickoff order
// (kept in sync with the official draw by lib/worldCupPoller.ts).
router.get("/matches", async (_req, res) => {
  const matches = await prisma.worldCupMatch.findMany({ orderBy: { kickoffAt: "asc" } });
  res.json(matches);
});

export default router;
