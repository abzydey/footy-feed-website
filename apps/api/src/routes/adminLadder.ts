import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const ladderEntrySchema = z.object({
  teamId: z.string().min(1),
  played: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  draws: z.number().int().min(0),
  pointsFor: z.number().int().min(0),
  pointsAgainst: z.number().int().min(0),
  competitionPoints: z.number().int().min(0),
  form: z
    .string()
    .regex(/^[WLD]*$/, "form must be only W/L/D characters")
    .max(10)
    .optional(),
});

const updateLadderSchema = z.object({
  asOfRound: z.number().int().min(1),
  roundInProgress: z.boolean().optional(),
  rows: z.array(ladderEntrySchema),
});

// PUT /api/admin/ladder — replaces the whole table in one call, matching how
// it's actually updated: the admin re-enters all 17 teams' rows after each
// round, not one team at a time. Each row is an upsert keyed on teamId, all
// in one transaction so a partial failure can't leave the table half-updated.
// asOfRound is set explicitly here rather than derived from played counts —
// see schema.prisma design note on LadderMeta (byes make max(played) an
// unreliable stand-in for the actual round number).
router.put("/", async (req, res) => {
  const parsed = updateLadderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  await prisma.$transaction([
    prisma.ladderMeta.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        asOfRound: parsed.data.asOfRound,
        roundInProgress: parsed.data.roundInProgress ?? false,
      },
      update: {
        asOfRound: parsed.data.asOfRound,
        roundInProgress: parsed.data.roundInProgress ?? false,
      },
    }),
    ...parsed.data.rows.map((row) =>
      prisma.ladderEntry.upsert({
        where: { teamId: row.teamId },
        create: row,
        update: row,
      })
    ),
  ]);

  res.status(204).end();
});

export default router;
