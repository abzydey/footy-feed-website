import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;

// GET /api/injuries — every player across all 17 clubs with a non-AVAILABLE/
// UNKNOWN currentStatus, for a single league-wide injury list. Reads the
// same denormalized Player.currentStatus cache team pages already use (see
// schema.prisma design note) — just queried across every team at once
// instead of one team page at a time, so no new data entry or schema is
// needed.
router.get("/", async (_req, res) => {
  const players = await prisma.player.findMany({
    where: { currentStatus: { notIn: ["AVAILABLE", "UNKNOWN"] } },
    include: { team: { select: teamSelect } },
    orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
  });
  res.json(players);
});

export default router;
