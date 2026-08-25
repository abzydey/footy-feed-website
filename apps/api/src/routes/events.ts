import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin, AdminAuthedRequest } from "../middleware/adminAuth";
import { notifyFollowersOfEvent } from "../lib/notify";

const router = Router();
router.use(requireAdmin);

const createEventSchema = z
  .object({
    type: z.enum(["INJURY", "LINEUP_CHANGE", "NEWS", "TRANSFER", "GENERAL_NEWS"]),
    teamId: z.string().optional(),
    playerId: z.string().optional(),
    headline: z.string().min(1).max(140),
    body: z.string().min(1).max(1000),
    newStatus: z.enum(["UNKNOWN", "AVAILABLE", "QUESTIONABLE", "OUT", "INJURED", "SUSPENDED"]).optional(),
    sourceUrl: z.string().url().optional(),
  })
  // GENERAL_NEWS is league-wide by definition, so it's the one type allowed
  // to skip both teamId and playerId — everything else needs at least one.
  .refine((data) => data.type === "GENERAL_NEWS" || data.teamId || data.playerId, {
    message: "An event must reference a teamId, a playerId, or be type GENERAL_NEWS",
  });

// GET /api/admin/events — recent entries, for the admin panel's activity feed.
router.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      team: { select: { id: true, name: true, slug: true } },
      player: { select: { id: true, name: true, slug: true } },
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

  const event = await prisma.event.create({
    data: {
      type: data.type,
      teamId: data.teamId,
      playerId: data.playerId,
      headline: data.headline,
      body: data.body,
      newStatus: data.newStatus,
      sourceUrl: data.sourceUrl,
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

export default router;
