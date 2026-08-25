import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/search?q=... — timestamped podcast transcript search.
//
// v1 implementation: a simple ILIKE scan over transcript_segments, fine for
// the 1-2 podcasts / few dozen episodes this starts with. Once there's real
// volume, swap the `contains` filter below for a raw query against a
// `search_vector tsvector` column + GIN index (see README "Podcast search" —
// that migration is intentionally not run yet so v1 stays simple).
router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);

  const segments = await prisma.transcriptSegment.findMany({
    where: { text: { contains: q, mode: "insensitive" } },
    orderBy: { startSeconds: "asc" },
    take: 30,
    include: {
      episode: { include: { podcast: { select: { name: true, slug: true } } } },
    },
  });

  res.json(
    segments.map((s) => ({
      podcast: s.episode.podcast.name,
      podcastSlug: s.episode.podcast.slug,
      episodeTitle: s.episode.title,
      episodeId: s.episode.id,
      audioUrl: s.episode.audioUrl,
      startSeconds: s.startSeconds,
      snippet: s.text,
    }))
  );
});

export default router;
