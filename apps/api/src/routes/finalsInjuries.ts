import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, primaryColor: true } as const;

// GET /api/finals-injuries — the current finals injury watch snapshot, every
// team that has one (the /finals page itself narrows this down to teams
// still alive in the bracket — see lib/finalsBracket.ts on the client).
// Newest-updated first within a team's own group isn't meaningful here (it's
// a live snapshot, not a history log — see schema.prisma design note), so
// this just orders by team name for a stable, predictable list.
router.get("/", async (_req, res) => {
  const entries = await prisma.finalsInjuryEntry.findMany({
    orderBy: [{ team: { name: "asc" } }, { player: "asc" }],
    include: { team: { select: teamSelect } },
  });
  res.json(entries);
});

export default router;
