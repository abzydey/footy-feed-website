import { prisma } from "./prisma";

export const isYouTubeDiscoveryConfigured = Boolean(process.env.YOUTUBE_API_KEY);
export const isSpotifyDiscoveryConfigured = Boolean(
  process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
);

// Matches lines like "0:00 Intro" or "1:23:45 - Some Topic" — the
// convention YouTube itself uses to auto-generate chapter markers from a
// description. Captures the timestamp and the rest of the line as the label.
const CHAPTER_LINE = /^\(?((?:\d{1,2}:)?\d{1,2}:\d{2})\)?\s*[-–—:]?\s*(.+)$/;

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  return parts.reduce((acc, part) => acc * 60 + part, 0);
}

export function parseChapters(description: string): { timestampSeconds: number; label: string }[] {
  const chapters: { timestampSeconds: number; label: string }[] = [];
  for (const line of description.split("\n")) {
    const match = line.trim().match(CHAPTER_LINE);
    if (!match) continue;
    const label = match[2].trim();
    if (!label) continue;
    chapters.push({ timestampSeconds: timestampToSeconds(match[1]), label });
  }
  return chapters;
}

// --- YouTube -----------------------------------------------------------
// Deliberately uses playlistItems.list (1 quota unit) to check a channel's
// uploads for new videos, not search.list (100 units — burns the free
// 10,000/day quota after ~100 calls). videos.list (also cheap, batchable up
// to 50 IDs per call) fetches full descriptions for only the videos we
// haven't already indexed.

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
}

async function fetchYouTubeUploads(channelId: string, existingIds: Set<string>): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  // A channel's "uploads" playlist ID is always its channel ID with the
  // leading "UC" swapped for "UU" — avoids an extra channels.list call.
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;

  const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  playlistUrl.searchParams.set("part", "contentDetails");
  playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
  playlistUrl.searchParams.set("maxResults", "10");
  playlistUrl.searchParams.set("key", apiKey);

  const playlistRes = await fetch(playlistUrl);
  if (!playlistRes.ok) {
    throw new Error(`YouTube playlistItems failed (${playlistRes.status}): ${await playlistRes.text()}`);
  }
  const playlistData = (await playlistRes.json()) as {
    items: { contentDetails: { videoId: string } }[];
  };

  const newVideoIds = playlistData.items
    .map((item) => item.contentDetails.videoId)
    .filter((id) => !existingIds.has(id));
  if (newVideoIds.length === 0) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet");
  videosUrl.searchParams.set("id", newVideoIds.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) {
    throw new Error(`YouTube videos.list failed (${videosRes.status}): ${await videosRes.text()}`);
  }
  const videosData = (await videosRes.json()) as {
    items: { id: string; snippet: { title: string; description: string; publishedAt: string } }[];
  };

  return videosData.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
  }));
}

// --- Spotify -------------------------------------------------------------
// Client Credentials flow — catalog-only, no user auth, free. Token is
// cached in-process until shortly before it expires (Spotify tokens last an
// hour) rather than fetched on every poll.

let spotifyToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (spotifyToken && spotifyToken.expiresAt > Date.now()) return spotifyToken.value;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  spotifyToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return spotifyToken.value;
}

interface SpotifyEpisode {
  id: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string | null;
}

async function fetchSpotifyEpisodes(showId: string, existingIds: Set<string>): Promise<SpotifyEpisode[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  const url = new URL(`https://api.spotify.com/v1/shows/${showId}/episodes`);
  url.searchParams.set("market", "AU");
  url.searchParams.set("limit", "10");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify episodes request failed (${res.status}): ${await res.text()}`);

  const data = (await res.json()) as {
    items: {
      id: string;
      name: string;
      description: string;
      external_urls: { spotify: string };
      release_date: string | null;
    }[];
  };

  return data.items
    .filter((ep) => !existingIds.has(ep.id))
    .map((ep) => ({
      id: ep.id,
      title: ep.name,
      description: ep.description,
      url: ep.external_urls.spotify,
      publishedAt: ep.release_date,
    }));
}

// --- Orchestration ---------------------------------------------------------

// Pulls new episodes for one tracked show from whichever platform(s) it has
// an ID for, inserts them (with parsed chapters) as ExternalEpisode rows.
// Already-indexed episodes are skipped via the (source, externalId) unique
// constraint check up front, so re-polling an unchanged show costs the
// minimum: one cheap playlistItems/episodes list call, nothing more.
export async function discoverNewEpisodesForShow(show: {
  id: string;
  youtubeChannelId: string | null;
  spotifyShowId: string | null;
}): Promise<number> {
  const existing = await prisma.externalEpisode.findMany({
    where: { trackedShowId: show.id },
    select: { source: true, externalId: true },
  });
  const existingYouTubeIds = new Set(existing.filter((e) => e.source === "YOUTUBE").map((e) => e.externalId));
  const existingSpotifyIds = new Set(existing.filter((e) => e.source === "SPOTIFY").map((e) => e.externalId));

  let inserted = 0;

  if (show.youtubeChannelId && isYouTubeDiscoveryConfigured) {
    const videos = await fetchYouTubeUploads(show.youtubeChannelId, existingYouTubeIds);
    for (const video of videos) {
      const episode = await prisma.externalEpisode.create({
        data: {
          trackedShowId: show.id,
          source: "YOUTUBE",
          externalId: video.id,
          title: video.title,
          description: video.description,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          publishedAt: new Date(video.publishedAt),
        },
      });
      const chapters = parseChapters(video.description);
      if (chapters.length > 0) {
        await prisma.externalEpisodeChapter.createMany({
          data: chapters.map((c) => ({ ...c, externalEpisodeId: episode.id })),
        });
      }
      inserted++;
    }
  }

  if (show.spotifyShowId && isSpotifyDiscoveryConfigured) {
    const episodes = await fetchSpotifyEpisodes(show.spotifyShowId, existingSpotifyIds);
    for (const ep of episodes) {
      const created = await prisma.externalEpisode.create({
        data: {
          trackedShowId: show.id,
          source: "SPOTIFY",
          externalId: ep.id,
          title: ep.title,
          description: ep.description,
          url: ep.url,
          publishedAt: ep.publishedAt ? new Date(ep.publishedAt) : null,
        },
      });
      // Spotify descriptions occasionally use the same chapter-line convention.
      const chapters = parseChapters(ep.description);
      if (chapters.length > 0) {
        await prisma.externalEpisodeChapter.createMany({
          data: chapters.map((c) => ({ ...c, externalEpisodeId: created.id })),
        });
      }
      inserted++;
    }
  }

  return inserted;
}
