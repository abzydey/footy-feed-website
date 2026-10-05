import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/world-cup/matches — every men's World Cup game, in kickoff order
// (kept in sync with the official draw by lib/worldCupPoller.ts).
router.get("/matches", async (_req, res) => {
  const matches = await prisma.worldCupMatch.findMany({ orderBy: { kickoffAt: "asc" } });
  res.json(matches);
});



// GET /api/world-cup/matches/:id — one game plus both sides' team lists,
// each as { INITIAL, TWENTY_FOUR_HOUR, FINAL } (same shape the club game
// page uses, so the web reuses its team-list card).
router.get("/matches/:id", async (req, res) => {
  const match = await prisma.worldCupMatch.findUnique({ where: { id: req.params.id } });
  if (!match) return res.status(404).json({ error: "Match not found" });
  const lists = await prisma.event.findMany({
    where: { worldCupMatchId: match.id, type: "LINEUP_CHANGE" },
    orderBy: { createdAt: "asc" },
  });
  const stagesFor = (side: string) => {
    const pick = (stage: string) => lists.find((e) => e.worldCupSide === side && e.teamListStage === stage) ?? null;
    return { INITIAL: pick("INITIAL"), TWENTY_FOUR_HOUR: pick("TWENTY_FOUR_HOUR"), FINAL: pick("FINAL") };
  };
  res.json({ match, home: stagesFor("HOME"), away: stagesFor("AWAY") });
});
// GET /api/world-cup/squads — every announced men's squad (nations not
// yet announced simply aren't in the list).
router.get("/squads", async (_req, res) => {
  const squads = await prisma.worldCupSquad.findMany({ orderBy: { name: "asc" } });
  res.json(squads);
});

export default router;
