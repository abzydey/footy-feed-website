import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/podcasts — list the (1-2, for v1) tracked podcasts.
router.get("/", async (_req, res) => {
  const podcasts = await prisma.podcast.findMany({ orderBy: { name: "asc" } });
  res.json(podcasts);
});

// GET /api/podcasts/:slug/episodes — episode list with transcript status,
// mainly for the admin panel to see what's been transcribed.
router.get("/:slug/episodes", async (req, res) => {
  const podcast = await prisma.podcast.findUnique({ where: { slug: req.params.slug } });
  if (!podcast) return res.status(404).json({ error: "Podcast not found" });

  const episodes = await prisma.episode.findMany({
    where: { podcastId: podcast.id },
    orderBy: { publishedAt: "desc" },
  });
  res.json({ podcast, episodes });
});

export default router;
