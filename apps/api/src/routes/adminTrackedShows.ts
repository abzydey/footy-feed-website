import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";
import { discoverNewEpisodesForShow } from "../lib/podcastDiscovery";

const router = Router();
router.use(requireAdmin);

const createShowSchema = z
  .object({
    name: z.string().min(1).max(120),
    youtubeChannelId: z.string().min(1).optional(),
    spotifyShowId: z.string().min(1).optional(),
  })
  .refine((data) => data.youtubeChannelId || data.spotifyShowId, {
    message: "Provide at least one of youtubeChannelId or spotifyShowId",
  });

// GET /api/admin/tracked-shows — every show currently feeding "What's Been
// Said" search coverage, with episode counts so the admin can see it's
// actually indexing something.
router.get("/", async (_req, res) => {
  const shows = await prisma.trackedShow.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { episodes: true } } },
  });
  res.json(shows);
});

// POST /api/admin/tracked-shows — add a show to track. Runs an initial
// discovery pass immediately (not fire-and-forget — the admin wants to see
// it worked right away) rather than waiting for the next 30-min poll.
router.post("/", async (req, res) => {
  const parsed = createShowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const show = await prisma.trackedShow.create({
    data: {
      name: data.name,
      youtubeChannelId: data.youtubeChannelId,
      spotifyShowId: data.spotifyShowId,
    },
  });

  let indexed = 0;
  try {
    indexed = await discoverNewEpisodesForShow(show);
  } catch (err) {
    console.error(`Initial discovery failed for "${show.name}":`, err);
  }

  res.status(201).json({ ...show, episodesIndexed: indexed });
});

// DELETE /api/admin/tracked-shows/:id — stop tracking a show (its already-
// indexed episodes/chapters are removed too via cascade).
router.delete("/:id", async (req, res) => {
  await prisma.trackedShow.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).send();
});

export default router;
