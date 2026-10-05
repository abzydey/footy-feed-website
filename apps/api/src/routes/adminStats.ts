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

  // People, not page loads: distinct anonymous visitor ids (recorded from
  // 2026-10-05 on), by Sydney day for the last 14 days plus 7/30-day totals.
  const [visitorDays, visitorTotals] = await Promise.all([
    prisma.$queryRaw<{ day: string; visitors: number; views: number }[]>`
      select to_char(("createdAt" at time zone 'Australia/Sydney')::date, 'YYYY-MM-DD') as day,
             count(distinct "visitorId")::int as visitors,
             count(*)::int as views
      from page_views
      where "createdAt" > now() - interval '14 days'
      group by 1 order by 1 desc`,
    prisma.$queryRaw<{ last7: number; last30: number }[]>`
      select count(distinct "visitorId") filter (where "createdAt" > now() - interval '7 days')::int as last7,
             count(distinct "visitorId") filter (where "createdAt" > now() - interval '30 days')::int as last30
      from page_views`,
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
    visitors: {
      last7Days: visitorTotals[0]?.last7 ?? 0,
      last30Days: visitorTotals[0]?.last30 ?? 0,
      byDay: visitorDays,
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
