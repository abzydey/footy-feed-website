import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin, AdminAuthedRequest } from "../middleware/adminAuth";
import { notifyFollowersOfEvent } from "../lib/notify";
import { fetchTweetAuthorName } from "../lib/twitterEmbed";

const router = Router();
router.use(requireAdmin);

const createEventSchema = z
  .object({
    type: z.enum(["INJURY", "LINEUP_CHANGE", "NEWS", "TRANSFER", "GENERAL_NEWS", "SOCIAL_POST"]),
    teamId: z.string().optional(),
    playerId: z.string().optional(),
    gameId: z.string().optional(),
    headline: z.string().min(1).max(140),
    body: z.string().min(1).max(1000),
    newStatus: z.enum(["UNKNOWN", "AVAILABLE", "QUESTIONABLE", "OUT", "INJURED", "SUSPENDED"]).optional(),
    teamListStage: z.enum(["INITIAL", "TWENTY_FOUR_HOUR", "FINAL"]).optional(),
    sourceUrl: z.string().url().optional(),
    sourceName: z.string().max(80).optional(),
    sourceAuthor: z.string().max(80).optional(),
  })
  // GENERAL_NEWS and SOCIAL_POST are both allowed to skip teamId/playerId —
  // league-wide news and tweet-style chatter usually aren't team-specific.
  // Everything else needs at least one of teamId/playerId/gameId.
  .refine(
    (data) =>
      data.type === "GENERAL_NEWS" || data.type === "SOCIAL_POST" || data.teamId || data.playerId || data.gameId,
    {
      message: "An event must reference a teamId, playerId, or gameId, or be type GENERAL_NEWS/SOCIAL_POST",
    }
  );

// GET /api/admin/events — recent entries, for the admin panel's activity feed.
router.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      team: { select: { id: true, name: true, slug: true } },
      player: { select: { id: true, name: true, slug: true } },
      game: {
        select: {
          id: true,
          round: true,
          homeTeam: { select: { shortName: true } },
          awayTeam: { select: { shortName: true } },
        },
      },
    },
  });
  res.json(events);
});

// POST /api/admin/events — the single write path admins use to enter an
// injury update, lineup change, or news blurb. This is what feeds both the
// brief pages (read directly from Event) and the alert pipeline (fan-out
// notification below).
router.post("/", async (req: AdminAuthedRequest, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  // A manually-entered SOCIAL_POST whose sourceUrl is a tweet gets the same
  // real display-name lookup as poller-created ones (see
  // lib/socialPoller.ts) unless the admin already typed one in — harmless
  // no-op (fetchTweetAuthorName resolves null) for a non-tweet URL.
  const sourceAuthor =
    data.sourceAuthor ??
    (data.type === "SOCIAL_POST" && data.sourceUrl ? (await fetchTweetAuthorName(data.sourceUrl)) ?? undefined : undefined);

  const event = await prisma.event.create({
    data: {
      type: data.type,
      teamId: data.teamId,
      playerId: data.playerId,
      gameId: data.gameId,
      headline: data.headline,
      body: data.body,
      newStatus: data.newStatus,
      teamListStage: data.teamListStage,
      sourceUrl: data.sourceUrl,
      sourceName: data.sourceName,
      sourceAuthor,
      createdBy: req.admin?.email,
    },
  });

  // Keep Player.currentStatus in sync so brief pages don't need to
  // recompute it from Event history on every read.
  if (data.type === "INJURY" && data.playerId && data.newStatus) {
    await prisma.player.update({
      where: { id: data.playerId },
      data: {
        currentStatus: data.newStatus,
        currentStatusNote: data.body,
        statusUpdatedAt: new Date(),
      },
    });
  }

  // Fire-and-forget: notify followers of this team/player. Errors here
  // shouldn't fail the admin's save, so they're logged, not thrown.
  notifyFollowersOfEvent(event.id).catch((err) =>
    console.error(`notifyFollowersOfEvent failed for event ${event.id}:`, err)
  );

  res.status(201).json(event);
});

const updateEventSchema = z.object({
  headline: z.string().min(1).max(140).optional(),
  body: z.string().min(1).max(1000).optional(),
  // Lets a GENERAL_NEWS story (normally teamId-less — see schema.prisma
  // design notes) also surface on one club's team page when it's really
  // about that club, without losing its place in the league-wide feed
  // (routes/feed.ts queries by type, not teamId, so this doesn't remove it
  // from Home/News). routes/teams.ts's recentEvents query already matches
  // any type by teamId, so no other change was needed to support this.
  teamId: z.string().optional(),
});

// PATCH /api/admin/events/:id — fix a typo, correct already-entered content
// (e.g. missing jersey numbers on a team list), or tag a GENERAL_NEWS story
// to a team — without deleting and re-creating the event, which would lose
// its place in "latest per stage" lookups (see routes/teams.ts,
// routes/games.ts) and re-trigger a notification. Deliberately narrow —
// type/game/stage aren't editable, since changing those is really "a
// different event," not a correction.
router.patch("/:id", async (req, res) => {
  const parsed = updateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const event = await prisma.event
    .update({ where: { id: req.params.id }, data: parsed.data })
    .catch(() => null);
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

export default router;
