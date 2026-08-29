import { Router } from "express";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";
import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";
import { PAGES } from "./pageviews";

const router = Router();
router.use(requireAdmin);

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/admin/stats — the numbers that matter before inviting a test
// group: is anyone following anything, has anyone granted push permission,
// and is anyone actually opening each page. Deliberately just a JSON blob
// (no dashboard) — see design note in schema.prisma on PageView.
router.get("/", async (_req, res) => {
  const [teams, teamFollowCounts, generalNewsFollowerCount, totalSubscribers, pageViewTotals, pageViewRecent] =
    await Promise.all([
      prisma.team.findMany({ select: { id: true, name: true, shortName: true }, orderBy: { name: "asc" } }),
      prisma.follow.groupBy({ by: ["targetId"], where: { targetType: "TEAM" }, _count: true }),
      prisma.follow.count({ where: { targetType: "LEAGUE", targetId: GENERAL_NEWS_TARGET_ID } }),
      prisma.subscriber.count(),
      prisma.pageView.groupBy({ by: ["page"], _count: true }),
      prisma.pageView.groupBy({
        by: ["page"],
        _count: true,
        where: { createdAt: { gte: new Date(Date.now() - SEVEN_DAYS_MS) } },
      }),
    ]);

  const countByTeamId = new Map(teamFollowCounts.map((c) => [c.targetId, c._count]));
  const totalByPage = new Map(pageViewTotals.map((p) => [p.page, p._count]));
  const recentByPage = new Map(pageViewRecent.map((p) => [p.page, p._count]));

  res.json({
    follows: {
      byTeam: teams.map((t) => ({
        teamId: t.id,
        name: t.name,
        shortName: t.shortName,
        followerCount: countByTeamId.get(t.id) ?? 0,
      })),
      generalNewsFollowerCount,
    },
    // Every Subscriber row exists only because a browser granted push
    // permission (see routes/follows.ts) — so this count *is* the opt-in
    // count. The per-team/general breakdown of *who* opted into what is the
    // follow counts above: a subscriber "opts in" to a category by
    // following it, there's no separate opt-in step.
    notificationOptIns: {
      total: totalSubscribers,
    },
    pageViews: {
      byPage: PAGES.map((page) => ({
        page,
        total: totalByPage.get(page) ?? 0,
        last7Days: recentByPage.get(page) ?? 0,
      })),
    },
  });
});

export default router;
