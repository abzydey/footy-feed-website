import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";

const router = Router();
router.use(requireAdmin);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const createPlayerSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(80),
  position: z.string().max(40).optional(),
  jerseyNumber: z.number().int().positive().optional(),
});

// Shared by both the single-add and bulk-add routes below.
async function createPlayerWithUniqueSlug(data: {
  teamId: string;
  name: string;
  position?: string;
  jerseyNumber?: number;
}) {
  const baseSlug = slugify(data.name) || "player";
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.player.findUnique({ where: { teamId_slug: { teamId: data.teamId, slug } } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return prisma.player.create({
    data: { teamId: data.teamId, name: data.name, slug, position: data.position, jerseyNumber: data.jerseyNumber },
  });
}

// POST /api/admin/players — add a single player to a team's roster. Without
// this, team pages' squad/injury list have nothing to render, and INJURY
// events have no player to select. slug is derived from name, not entered
// by hand, deduped against the team's existing slugs if it collides.
router.post("/", async (req, res) => {
  const parsed = createPlayerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const player = await createPlayerWithUniqueSlug(parsed.data);
  res.status(201).json(player);
});

const bulkCreateSchema = z.object({
  teamId: z.string().min(1),
  players: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        position: z.string().max(40).optional(),
        jerseyNumber: z.number().int().positive().optional(),
      })
    )
    .min(1)
    .max(60),
});

// POST /api/admin/players/bulk — paste a full squad (25-30+ players) as
// parsed rows in one call, instead of the single-add form one at a time.
// Parsing the pasted text block happens client-side (see
// PlayerForm.tsx's parseSquadText) — this endpoint just takes the already-
// structured rows. Not wrapped in a transaction: a full squad paste is long
// enough that one malformed row shouldn't sink every valid one, so this
// creates what it can and reports how many succeeded.
router.post("/bulk", async (req, res) => {
  const parsed = bulkCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { teamId, players } = parsed.data;

  const created = [];
  for (const p of players) {
    created.push(await createPlayerWithUniqueSlug({ teamId, ...p }));
  }

  res.status(201).json({ created: created.length, players: created });
});

// DELETE /api/admin/players/:id — remove a player (e.g. entered on the
// wrong team, retired, or a duplicate).
router.delete("/:id", async (req, res) => {
  await prisma.player.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).send();
});

export default router;
