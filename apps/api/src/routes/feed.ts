import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/feed — data source for both Home's small preview and FeedPage's
// full Top/My Teams/Signing News browsing (see HomePage.tsx/FeedPage.tsx):
// GENERAL_NEWS + TRANSFER events, newest first. TRANSFER is included
// alongside GENERAL_NEWS (not INJURY/LINEUP_CHANGE/NEWS, which stay
// team-page-only) specifically so signings are "Top" feed material and have
// real content for the Signing News page to show — a signing is
// league-interest news even though it's tagged to one club. SOCIAL_POST
// events have their own dedicated destination (see routes/social.ts) rather
// than being interleaved here. A reader of the single Event table alongside
// team pages, game pages, the Social section, and the alert pipeline (see
// schema.prisma design notes).
//
// ?limit= (default 40, matching the old hardcoded value — right-sized for
// Home's small preview) lets FeedPage ask for a much bigger window instead.
// Without this, a real signing quietly vanishes from the dedicated Signing
// News page once ~40 newer GENERAL_NEWS/TRANSFER stories accumulate after
// it — the story never stops existing, it just ages out of a limit that was
// only ever meant to cap a homepage teaser, not bound what "browse all
// signings" can see.
//
// Same dedup as routes/teams.ts's recentEvents, and for the same reason: a
// signing gets both a TRANSFER row and a matching GENERAL_NEWS copy, and a
// story tagged to multiple clubs (see CONTRIBUTING-news.md's team-tagging
// rule — an Event only carries one team each) gets one row per team. All of
// that is correct for team pages, which query by teamId, but this feed has
// no teamId filter at all, so every one of those rows would otherwise show
// up here as its own card. Fetches extra (limit*3) before deduping so a
// heavy multi-team story doesn't crowd out real distinct stories from the
// requested page size.
router.get("/", async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 300) : 40;

  const rawEvents = await prisma.event.findMany({
    where: { type: { in: ["GENERAL_NEWS", "TRANSFER"] } },
    orderBy: { createdAt: "desc" },
    take: limit * 3,
    include: {
      team: { select: { id: true, name: true, shortName: true, slug: true } },
      player: { select: { id: true, name: true, slug: true } },
      game: {
        select: {
          id: true,
          round: true,
          homeTeam: { select: { shortName: true, slug: true } },
          awayTeam: { select: { shortName: true, slug: true } },
        },
      },
    },
  });

  const seenEventKeys = new Set<string>();
  const events = rawEvents
    .filter((e) => {
      const key = e.sourceUrl ?? e.headline;
      if (seenEventKeys.has(key)) return false;
      seenEventKeys.add(key);
      return true;
    })
    .slice(0, limit);

  res.json(events);
});

export default router;
