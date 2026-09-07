import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const entrySchema = z.object({
  teamId: z.string().min(1),
  player: z.string().min(1).max(80),
  injury: z.string().min(1).max(120),
  status: z.enum(["OUT", "LIKELY", "UNLIKELY", "TBA", "TBC"]),
});

const setFinalsInjuriesSchema = z.object({
  entries: z.array(entrySchema),
});

// PUT /api/admin/finals-injuries — replaces the whole snapshot in one call,
// same "full replace" pattern as PUT /api/admin/ladder, not JudiciaryCharge's
// per-round history: this table only ever holds "the current state of play,"
// so a team eliminated from finals is simply left out of the next PUT rather
// than needing an explicit delete. Source data comes from the same
// screenshot -> admin-script pipeline used for team lists/ladder/scores —
// this just recognises the finals injury watch post as another input shape
// feeding the same PUT, not a new pipeline.
router.put("/", async (req, res) => {
  const parsed = setFinalsInjuriesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  await prisma.$transaction([
    prisma.finalsInjuryEntry.deleteMany({}),
    prisma.finalsInjuryEntry.createMany({ data: parsed.data.entries }),
  ]);

  const saved = await prisma.finalsInjuryEntry.findMany({
    orderBy: [{ team: { name: "asc" } }, { player: "asc" }],
    include: { team: { select: { id: true, name: true, shortName: true, slug: true, primaryColor: true } } },
  });
  res.status(200).json(saved);
});

export default router;
