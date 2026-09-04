import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;

// GET /api/judiciary — charges for one round, oldest game-day first isn't
// meaningful here (no kickoff time on a charge) so newest-entered first.
// Optional ?round= filters to just that round, same convention as GET
// /api/games — omit it and the most recently *reported* round is used (see
// JudiciaryReport design note), not the most recent round with a charge —
// a clean round still needs to be the one shown, not skipped over.
router.get("/", async (req, res) => {
  const requestedRound = typeof req.query.round === "string" ? req.query.round : undefined;
  const round = requestedRound ?? (await prisma.judiciaryReport.findFirst({ orderBy: { createdAt: "desc" } }))?.round;
  if (!round) return res.json([]);

  const charges = await prisma.judiciaryCharge.findMany({
    where: { round },
    orderBy: { createdAt: "asc" },
    include: { team: { select: teamSelect } },
  });
  res.json(charges);
});

// GET /api/judiciary/rounds — every round a report has been entered for
// (JudiciaryReport, not distinct rounds in JudiciaryCharge — see
// schema.prisma design note), oldest first so the Judiciary page's
// previous/next navigation steps through them in the order they happened.
router.get("/rounds", async (_req, res) => {
  const reports = await prisma.judiciaryReport.findMany({
    select: { round: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(reports.map((r) => r.round));
});

export default router;
