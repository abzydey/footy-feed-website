import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";

const router = Router();

const followSchema = z.object({
  fcmToken: z.string().min(1),
  targetType: z.enum(["TEAM", "PLAYER", "LEAGUE"]),
  targetId: z.string().min(1),
});

// POST /api/follows — register (or reuse) a Subscriber for this browser's
// FCM token, then create the follow. Called right after the browser grants
// notification permission and hands back a token — no login involved.
router.post("/", async (req, res) => {
  const parsed = followSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { fcmToken, targetType, targetId } = parsed.data;

  // Confirm the target actually exists before creating a dangling follow —
  // targetId isn't a real FK since Follow is polymorphic (see schema notes).
  // LEAGUE has no table to check against — it's a fixed category, not a row —
  // so it's valid as long as the frontend sent the one constant we expect.
  const exists =
    targetType === "TEAM"
      ? await prisma.team.findUnique({ where: { id: targetId }, select: { id: true } })
      : targetType === "PLAYER"
        ? await prisma.player.findUnique({ where: { id: targetId }, select: { id: true } })
        : targetId === GENERAL_NEWS_TARGET_ID;
  if (!exists) {
    return res.status(404).json({ error: `${targetType} not found` });
  }

  const subscriber = await prisma.subscriber.upsert({
    where: { fcmToken },
    create: { fcmToken },
    update: { lastSeenAt: new Date() },
  });

  const follow = await prisma.follow.upsert({
    where: { subscriberId_targetType_targetId: { subscriberId: subscriber.id, targetType, targetId } },
    create: { subscriberId: subscriber.id, targetType, targetId },
    update: {},
  });

  res.status(201).json(follow);
});

// GET /api/follows/:fcmToken — list what this browser currently follows,
// so the UI can render filled-in "following" buttons on load.
router.get("/:fcmToken", async (req, res) => {
  const subscriber = await prisma.subscriber.findUnique({
    where: { fcmToken: req.params.fcmToken },
    include: { follows: true },
  });
  res.json(subscriber?.follows ?? []);
});

// DELETE /api/follows/:id — unfollow.
router.delete("/:id", async (req, res) => {
  await prisma.follow.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).send();
});

export default router;
