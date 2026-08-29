import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/ladder — the full 17-team table, ranked. Every team is returned
// even if it has no LadderEntry row yet (defaults to all zeros) so the page
// shows a complete table from day one, not a sparse list that fills in as
// the admin enters rounds. Rank and points differential are computed here,
// not stored — see schema.prisma design note on LadderEntry.
router.get("/", async (_req, res) => {
  const [teams, entries, meta] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, shortName: true, slug: true } }),
    prisma.ladderEntry.findMany(),
    prisma.ladderMeta.findUnique({ where: { id: "singleton" } }),
  ]);

  const entryByTeamId = new Map(entries.map((e) => [e.teamId, e]));

  const rows = teams.map((team) => {
    const entry = entryByTeamId.get(team.id);
    const played = entry?.played ?? 0;
    const wins = entry?.wins ?? 0;
    const losses = entry?.losses ?? 0;
    const draws = entry?.draws ?? 0;
    const pointsFor = entry?.pointsFor ?? 0;
    const pointsAgainst = entry?.pointsAgainst ?? 0;
    const competitionPoints = entry?.competitionPoints ?? 0;
    return {
      team,
      played,
      wins,
      losses,
      draws,
      pointsFor,
      pointsAgainst,
      pointsDifferential: pointsFor - pointsAgainst,
      competitionPoints,
      form: entry?.form ?? null,
    };
  });

  // Standard NRL ladder ordering: competition points first, then points
  // differential, then points for, as tiebreakers.
  rows.sort((a, b) => {
    if (b.competitionPoints !== a.competitionPoints) return b.competitionPoints - a.competitionPoints;
    if (b.pointsDifferential !== a.pointsDifferential) return b.pointsDifferential - a.pointsDifferential;
    return b.pointsFor - a.pointsFor;
  });

  res.json({
    asOfRound: meta?.asOfRound ?? null,
    roundInProgress: meta?.roundInProgress ?? false,
    rows: rows.map((row, i) => ({ rank: i + 1, ...row })),
  });
});

export default router;
