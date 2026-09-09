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
// Deliberately NOT deduped here (a signing's TRANSFER row and its matching
// GENERAL_NEWS copy, or a story tagged to multiple clubs, both come through
// as separate rows) — lib/feed.ts's dedupeStories() does that client-side
// instead, and it has to: FeedPage's "Signing News" view filters this raw
// list down to type === "TRANSFER" *before* deduping, so an
// already-deduped-by-the-API list would be missing exactly the rows that
// view needs whenever a signing's GENERAL_NEWS copy happened to survive the
// dedup instead of its TRANSFER row (this was tried and broke Signing News
// entirely — see commit history).
router.get("/", async (req, res) => {
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 300) : 40;

  const events = await prisma.event.findMany({
    where: { type: { in: ["GENERAL_NEWS", "TRANSFER"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
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

  res.json(events);
});

export default router;
