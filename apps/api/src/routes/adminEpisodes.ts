import { randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/adminAuth";
import { isTranscriptionConfigured, transcribeEpisode } from "../lib/transcribe";

const router = Router();
router.use(requireAdmin);

const createEpisodeSchema = z.object({
  podcastId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  audioUrl: z.string().url(), // a pasted YouTube link, for the Podcasts browse page
  // The real downloadable audio file (RSS enclosure, e.g. an .mp3) — used
  // for transcription since audioUrl above is often just a YouTube page,
  // not a file Whisper can fetch. See schema.prisma design note on
  // Episode.transcriptAudioUrl.
  transcriptAudioUrl: z.string().url().optional(),
  publishedAt: z.coerce.date().optional(),
  durationSeconds: z.number().int().positive().optional(),
});

function runTranscription(episodeId: string) {
  transcribeEpisode(episodeId).catch((err) =>
    console.error(`transcribeEpisode failed for episode ${episodeId}:`, err)
  );
}

// POST /api/admin/episodes — manual episode entry for the Podcasts browse
// page (paste a YouTube link + title/description). guid is RSS-feed
// metadata that a manual entry doesn't have, so one is generated here.
// Whisper transcription is currently deprioritized (no OPENAI_API_KEY, by
// choice — see lib/transcribe.ts) in favor of staying fully on the free
// title/description/chapter search used for tracked shows (see
// lib/podcastDiscovery.ts and routes/search.ts, which now also matches on
// this Episode's own title/description directly). The pipeline itself is
// left intact and dormant, not deleted, in case that trade-off is revisited
// once there's real usage data — this route just doesn't auto-fire it.
router.post("/", async (req, res) => {
  const parsed = createEpisodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;

  const episode = await prisma.episode.create({
    data: {
      podcastId: data.podcastId,
      guid: randomUUID(),
      title: data.title,
      description: data.description,
      audioUrl: data.audioUrl,
      transcriptAudioUrl: data.transcriptAudioUrl,
      publishedAt: data.publishedAt ?? new Date(),
      durationSeconds: data.durationSeconds,
    },
    include: { podcast: { select: { name: true, slug: true } } },
  });

  res.status(201).json(episode);
});

// POST /api/admin/episodes/:id/transcribe — dormant unless OPENAI_API_KEY is
// set; returns a clear error instead of silently attempting (and failing) an
// OpenAI call with no key.
router.post("/:id/transcribe", async (req, res) => {
  if (!isTranscriptionConfigured) {
    return res.status(400).json({ error: "Transcription is disabled (no OPENAI_API_KEY set)" });
  }
  const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
  if (!episode) return res.status(404).json({ error: "Episode not found" });

  runTranscription(episode.id);
  res.status(202).json({ status: "PROCESSING" });
});

// DELETE /api/admin/episodes/:id — remove an episode from the Podcasts
// browse page (e.g. a placeholder added during setup, or a bad link).
router.delete("/:id", async (req, res) => {
  await prisma.episode.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).send();
});

export default router;
