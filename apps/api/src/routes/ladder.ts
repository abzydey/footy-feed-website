import { Router } from "express";

import { prisma } from "../lib/prisma";
import { sortByLadderRank } from "../lib/ladderRank";

const router = Router();

// GET /api/ladder — the full 17-team table, ranked. Every team is returned
// even if it has no LadderEntry row yet (defaults to all zeros) so the page
// shows a complete table from day one, not a sparse list that fills in as
// the admin enters rounds. Rank and points differential are computed here,
// not stored — see schema.prisma design note on LadderEntry.
router.get("/", async (_req, res) => {
  const [teams, entries, meta] = await Promise.all([
    // Perth Bears exist as a Team row (for tagging signing news to them
    // ahead of their 2027 NRL entry) but aren't part of the current
    // competition — excluded here so they don't show up as an 18th,
    // all-zeros row.
    prisma.team.findMany({
      where: { slug: { not: "perth-bears" } },
      select: { id: true, name: true, shortName: true, slug: true, primaryColor: true },
    }),
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
      previousRank: entry?.previousRank ?? null,
    };
  });

  const sorted = sortByLadderRank(rows);

  res.json({
    asOfRound: meta?.asOfRound ?? null,
    roundInProgress: meta?.roundInProgress ?? false,
    rows: sorted.map((row, i) => {
      const rank = i + 1;
      // null when there's no prior snapshot yet (team's first-ever ladder
      // entry) — the page shows no arrow rather than a misleading "same".
      const movement = row.previousRank == null ? null : row.previousRank === rank ? "same" : row.previousRank > rank ? "up" : "down";
      return { rank, movement, ...row };
    }),
  });
});

export default router;
