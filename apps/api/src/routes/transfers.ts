import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const TEAM_SELECT = { id: true, name: true, shortName: true, slug: true, primaryColor: true } as const;

// GET /api/transfers — the signings tracker's moves, newest first.
// ?team=<slug> narrows to moves involving that club (in, out or re-signed);
// ?limit=<n> caps the list (Home's preview card asks for a handful).
router.get("/", async (req, res) => {
  const slug = typeof req.query.team === "string" ? req.query.team : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

  let teamId: string | undefined;
  if (slug) {
    const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
    if (!team) return res.status(404).json({ error: "Team not found" });
    teamId = team.id;
  }

  const transfers = await prisma.transfer.findMany({
    where: teamId ? { OR: [{ toTeamId: teamId }, { fromTeamId: teamId }] } : undefined,
    orderBy: { announcedAt: "desc" },
    take: limit,
    include: {
      fromTeam: { select: TEAM_SELECT },
      toTeam: { select: TEAM_SELECT },
      event: { select: { id: true, headline: true, sourceUrl: true, sourceName: true, slug: true, isOriginalArticle: true } },
    },
  });

  res.json(transfers);
});

export default router;
