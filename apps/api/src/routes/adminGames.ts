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

// POST /api/admin/games/:id/result — log the final score + try scorers for a
// completed game, which is what flips the game page into its "finished"
// state (see routes/games.ts GET /:id and GamePage.tsx) — homeScore/awayScore
// being non-null is that signal, not a separate status enum. Replaces any
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
    prisma.game.update({ where: { id: game.id }, data: { homeScore, awayScore } }),
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

export default router;
