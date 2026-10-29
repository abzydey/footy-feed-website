import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const TEAM_SELECT = { id: true, name: true, shortName: true, slug: true, primaryColor: true } as const;

// The season the current free agency is for: players off contract at the
// end of 2027 can talk to rivals from 1 November 2026 and play for a new
// club in 2028.
export const FREE_AGENCY_SEASON = 2028;

// Names as the signings tracker might write them: no case, accents,
// apostrophes or hyphens ("Papali'i" = "Papalii", "Addo-Carr" = "Addo Carr").
const nameKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`.]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();

// GET /api/free-agents — every player on the free agency list for the
// season, each with where he's ended up. A player is off the market once
// the signings tracker has him re-signed, signed elsewhere or retired since
// the September before the deadline (older moves are earlier deals). A deal
// that ends before the season (Paulo re-signing "until 2027") is why he is
// on the list, not a way off it.
router.get("/", async (req, res) => {
  const season = Number(req.query.season) || FREE_AGENCY_SEASON;
  const since = new Date(Date.UTC(season - 2, 8, 1));

  const [agents, moves, teams] = await Promise.all([
    prisma.freeAgent.findMany({ where: { season }, include: { team: { select: TEAM_SELECT } }, orderBy: { player: "asc" } }),
    prisma.transfer.findMany({
      where: {
        announcedAt: { gte: since },
        kind: { in: ["RE_SIGNED", "SIGNED", "RETIRED"] },
        OR: [{ contractUntil: null }, { contractUntil: { gte: season } }],
      },
      orderBy: { announcedAt: "desc" },
      include: {
        toTeam: { select: TEAM_SELECT },
        event: { select: { id: true, headline: true, sourceUrl: true, slug: true, isOriginalArticle: true } },
      },
    }),
    prisma.team.findMany({ select: TEAM_SELECT }),
  ]);

  const latestMove = new Map<string, (typeof moves)[number]>();
  for (const m of moves) {
    const key = nameKey(m.player);
    if (!latestMove.has(key)) latestMove.set(key, m); // newest first
  }
  const teamBySlug = new Map(teams.map((t) => [t.slug, t]));

  res.json({
    season,
    players: agents.map((a) => {
      const move = [a.player, ...a.aliases].map((n) => latestMove.get(nameKey(n))).find(Boolean) ?? null;
      return {
        id: a.id,
        player: a.player,
        position: a.position,
        tier: a.tier,
        team: a.team,
        linked: a.linked.map((s) => teamBySlug.get(s)).filter(Boolean),
        freeAgentNow: a.freeAgentNow,
        note: a.note,
        status: move ? move.kind : "AVAILABLE",
        newTeam: move?.toTeam ?? null,
        newTeamLabel: move?.toLabel ?? null,
        until: move?.contractUntil ?? null,
        decidedAt: move?.announcedAt ?? null,
        story: move?.event ?? null,
      };
    }),
  });
});

export default router;
