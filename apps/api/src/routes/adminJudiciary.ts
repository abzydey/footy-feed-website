import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

const chargeSchema = z.object({
  player: z.string().min(1).max(80),
  teamId: z.string().min(1),
  charge: z.string().min(1).max(300),
  grade: z.string().min(1).max(40),
  result: z.string().min(1).max(120),
  matchesToServe: z.number().int().min(0).optional(),
  financialPenalty: z.number().int().min(0).optional(),
});

const setJudiciarySchema = z.object({
  round: z.string().min(1).max(60),
  charges: z.array(chargeSchema),
});

// POST /api/admin/judiciary — replaces every charge for the given round in
// one transaction, matching how the admin actually enters this: re-pasting
// the whole week's Judiciary Report rather than editing one charge at a
// time. Unlike PUT /api/admin/ladder (one current row per team, always
// overwritten) this is per-round history — only the named round's rows are
// touched, every other round's charges are untouched.
router.post("/", async (req, res) => {
  const parsed = setJudiciarySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { round, charges } = parsed.data;

  // Upserting JudiciaryReport marks the round as "reported" even when
  // charges is empty — otherwise a clean round would be indistinguishable
  // from one nobody has entered yet (see schema.prisma design note).
  await prisma.$transaction([
    prisma.judiciaryReport.upsert({ where: { round }, create: { round }, update: {} }),
    prisma.judiciaryCharge.deleteMany({ where: { round } }),
    prisma.judiciaryCharge.createMany({ data: charges.map((c) => ({ ...c, round })) }),
  ]);

  const saved = await prisma.judiciaryCharge.findMany({
    where: { round },
    orderBy: { createdAt: "asc" },
    include: { team: { select: { id: true, name: true, shortName: true, slug: true } } },
  });
  res.status(201).json(saved);
});

export default router;
