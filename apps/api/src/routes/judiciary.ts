import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const teamSelect = { id: true, name: true, shortName: true, slug: true, logoUrl: true, primaryColor: true } as const;

// Reported rounds, oldest first — chronological by that round's earliest
// Game kickoff (same convention as GET /api/games/rounds), NOT by when the
// admin happened to enter the report. Judiciary reports don't necessarily
// get entered in round order (e.g. a later round's "no charges" report
// logged before an earlier round's charges are pasted in), so sorting by
// JudiciaryReport.createdAt would silently scramble the page's prev/next
// navigation. A reported round with no matching Game (shouldn't normally
// happen, but not worth crashing over) sorts last rather than erroring.
async function chronologicalRounds(): Promise<string[]> {
  const [reports, games] = await Promise.all([
    prisma.judiciaryReport.findMany({ select: { round: true } }),
    prisma.game.findMany({ select: { round: true, kickoffAt: true } }),
  ]);
  const earliestKickoffByRound = new Map<string, number>();
  for (const g of games) {
    const existing = earliestKickoffByRound.get(g.round);
    const t = g.kickoffAt.getTime();
    if (existing === undefined || t < existing) earliestKickoffByRound.set(g.round, t);
  }
  return reports
    .map((r) => r.round)
    .sort((a, b) => (earliestKickoffByRound.get(a) ?? Infinity) - (earliestKickoffByRound.get(b) ?? Infinity));
}

// GET /api/judiciary — charges for one round, oldest game-day first isn't
// meaningful here (no kickoff time on a charge) so newest-entered first.
// Optional ?round= filters to just that round, same convention as GET
// /api/games — omit it and the chronologically latest reported round is
// used (see chronologicalRounds above), not the most recent round with a
// charge — a clean round still needs to be the one shown, not skipped over.
router.get("/", async (req, res) => {
  const requestedRound = typeof req.query.round === "string" ? req.query.round : undefined;
  const round = requestedRound ?? (await chronologicalRounds()).at(-1);
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
  res.json(await chronologicalRounds());
});

export default router;
