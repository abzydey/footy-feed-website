import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const createGameSchema = z
  .object({
    homeTeamId: z.string().min(1),
    awayTeamId: z.string().min(1),
    round: z.string().min(1).max(60),
    kickoffAt: z.coerce.date(),
    venue: z.string().max(120).optional(),
  })
  .refine((data) => data.homeTeamId !== data.awayTeamId, {
    message: "Home and away team must be different",
  });

// POST /api/admin/games — the single write path for fixtures. Create-only in
// Phase 1, same as events — no edit/delete yet.
router.post("/", async (req, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const game = await prisma.game.create({
    data,
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true, slug: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, slug: true } },
    },
  });

  res.status(201).json(game);
});

const trySchema = z.object({
  scorer: z.string().min(1).max(80),
  minute: z.coerce.number().int().min(1).max(120),
});

const setResultSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
  homeTries: z.array(trySchema),
  awayTries: z.array(trySchema),
});

// POST /api/admin/games/:id/result — log the FINAL score + try scorers for a
// completed game. This is what actually sets status to FULL_TIME (see
// schema.prisma design note on GameStatus) — a LIVE score from
// POST /:id/live-score below leaves scores non-null too, so status is what
// the game page actually keys off now, not score nullness. Replaces any
// previously-logged tries for this game rather than appending, so re-saving
// to fix a scorer/minute typo doesn't require deleting rows by hand.
router.post("/:id/result", async (req, res) => {
  const parsed = setResultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { homeScore, awayScore, homeTries, awayTries } = parsed.data;

  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) return res.status(404).json({ error: "Game not found" });

  await prisma.$transaction([
    prisma.try.deleteMany({ where: { gameId: game.id } }),
    prisma.game.update({ where: { id: game.id }, data: { homeScore, awayScore, status: "FULL_TIME" } }),
    prisma.try.createMany({
      data: [
        ...homeTries.map((t) => ({ ...t, gameId: game.id, teamId: game.homeTeamId })),
        ...awayTries.map((t) => ({ ...t, gameId: game.id, teamId: game.awayTeamId })),
      ],
    }),
  ]);

  const updated = await prisma.game.findUnique({
    where: { id: game.id },
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true, slug: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, slug: true } },
      tries: { orderBy: { minute: "asc" } },
    },
  });

  res.json(updated);
});

const setLiveScoreSchema = z.object({
  homeScore: z.coerce.number().int().min(0),
  awayScore: z.coerce.number().int().min(0),
});

// POST /api/admin/games/:id/live-score — quick in-play score update, for an
// admin watching the broadcast to punch in the current score every so often
// during the match. Deliberately lighter than POST /:id/result (no tries —
// those get logged properly at full-time): the point is a fast update, not
// a complete record. Sets status to LIVE, never FULL_TIME — only the real
// result endpoint above can mark a game finished, so this can't accidentally
// end a match early just by being called last.
router.post("/:id/live-score", async (req, res) => {
  const parsed = setLiveScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { homeScore, awayScore } = parsed.data;

  const game = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!game) return res.status(404).json({ error: "Game not found" });
  if (game.status === "FULL_TIME") {
    return res.status(400).json({ error: "Game is already marked full-time — edit via the result form instead." });
  }

  const updated = await prisma.game.update({
    where: { id: game.id },
    data: { homeScore, awayScore, status: "LIVE" },
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true, slug: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, slug: true } },
    },
  });

  res.json(updated);
});

export default router;
