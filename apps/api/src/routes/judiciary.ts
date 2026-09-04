import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;

// GET /api/judiciary — charges for one round, oldest game-day first isn't
// meaningful here (no kickoff time on a charge) so newest-entered first.
// Optional ?round= filters to just that round, same convention as GET
// /api/games — omit it and the most recent round with any charges is used,
// so the Judiciary page has something to show without a round picked yet.
router.get("/", async (req, res) => {
  const requestedRound = typeof req.query.round === "string" ? req.query.round : undefined;
  const round = requestedRound ?? (await prisma.judiciaryCharge.findFirst({ orderBy: { createdAt: "desc" } }))?.round;
  if (!round) return res.json([]);

  const charges = await prisma.judiciaryCharge.findMany({
    where: { round },
    orderBy: { createdAt: "asc" },
    include: { team: { select: teamSelect } },
  });
  res.json(charges);
});

// GET /api/judiciary/rounds — every round that has at least one charge,
// most recent first (charges only exist for rounds already played, so
// chronological-by-insertion is fine — no kickoff time to sort by here,
// unlike GET /api/games/rounds).
router.get("/rounds", async (_req, res) => {
  const charges = await prisma.judiciaryCharge.findMany({
    select: { round: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const rounds: string[] = [];
  for (const c of charges) {
    if (!seen.has(c.round)) {
      seen.add(c.round);
      rounds.push(c.round);
    }
  }
  res.json(rounds);
});

export default router;
