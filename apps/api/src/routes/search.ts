import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

interface SearchResult {
  kind: "transcript" | "chapter" | "episode";
  podcast: string;
  episodeTitle: string;
  url: string;
  startSeconds: number | null;
  snippet: string;
  publishedAt: string | null;
}

// GET /api/search?q=... — "What's Been Said". Merges four sources, all free:
//
// 1. TranscriptSegment — real Whisper transcripts, dormant (transcription is
//    currently off by choice, no OPENAI_API_KEY — see lib/transcribe.ts).
//    Left wired in case that trade-off is revisited later; costs nothing to
//    query an empty table.
// 2. ExternalEpisodeChapter — timestamps parsed from tracked shows' YouTube/
//    Spotify episode descriptions (see lib/podcastDiscovery.ts). Timestamped,
//    but only as precise as the creator's own chapter markers.
// 3. ExternalEpisode title/description — tracked-show episodes that mention
//    the query without a matching chapter line.
// 4. Episode title/description — the curated Podcasts-page episodes,
//    matched the same title/description way as tracked shows (see routes/
//    adminEpisodes.ts) rather than mixing in paid transcription for just
//    these five.
//
// v1 implementation: simple ILIKE scans, same reasoning as before (fine at
// this volume; upgrade to tsvector+GIN once there's real traffic).
router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);

  const [transcriptSegments, chapters, curatedEpisodes] = await Promise.all([
    prisma.transcriptSegment.findMany({
      where: { text: { contains: q, mode: "insensitive" } },
      orderBy: { startSeconds: "asc" },
      take: 20,
      include: {
        episode: { include: { podcast: { select: { name: true } } } },
      },
    }),
    prisma.externalEpisodeChapter.findMany({
      where: { label: { contains: q, mode: "insensitive" } },
      take: 20,
      include: {
        externalEpisode: { include: { trackedShow: { select: { name: true } } } },
      },
    }),
    prisma.episode.findMany({
      where: {
        OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }],
      },
      orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
      take: 20,
      include: { podcast: { select: { name: true } } },
    }),
  ]);

  const chapterEpisodeIds = new Set(chapters.map((c) => c.externalEpisodeId));

  const externalEpisodeMatches = await prisma.externalEpisode.findMany({
    where: {
      id: { notIn: [...chapterEpisodeIds] },
      OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
    take: 20,
    include: { trackedShow: { select: { name: true } } },
  });

  const snippetOf = (text: string) => (text.length > 220 ? `${text.slice(0, 220)}…` : text);

  const results: SearchResult[] = [
    ...transcriptSegments.map(
      (segment): SearchResult => ({
        kind: "transcript",
        podcast: segment.episode.podcast.name,
        episodeTitle: segment.episode.title,
        url: `${segment.episode.audioUrl}#t=${Math.floor(segment.startSeconds)}`,
        startSeconds: segment.startSeconds,
        snippet: segment.text,
        publishedAt: segment.episode.publishedAt?.toISOString() ?? null,
      })
    ),
    ...chapters.map((chapter): SearchResult => {
      const ep = chapter.externalEpisode;
      const timedUrl = ep.source === "YOUTUBE" ? `${ep.url}&t=${chapter.timestampSeconds}s` : ep.url;
      return {
        kind: "chapter",
        podcast: ep.trackedShow.name,
        episodeTitle: ep.title,
        url: timedUrl,
        startSeconds: chapter.timestampSeconds,
        snippet: chapter.label,
        publishedAt: ep.publishedAt?.toISOString() ?? null,
      };
    }),
    ...externalEpisodeMatches.map(
      (ep): SearchResult => ({
        kind: "episode",
        podcast: ep.trackedShow.name,
        episodeTitle: ep.title,
        url: ep.url,
        startSeconds: null,
        snippet: snippetOf(ep.description),
        publishedAt: ep.publishedAt?.toISOString() ?? null,
      })
    ),
    ...curatedEpisodes.map(
      (ep): SearchResult => ({
        kind: "episode",
        podcast: ep.podcast.name,
        episodeTitle: ep.title,
        url: ep.audioUrl,
        startSeconds: null,
        snippet: snippetOf(ep.description ?? ep.title),
        publishedAt: ep.publishedAt?.toISOString() ?? null,
      })
    ),
  ];

  res.json(results);
});

export default router;
