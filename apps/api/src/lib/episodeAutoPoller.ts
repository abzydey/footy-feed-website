import { prisma } from "./prisma";

// Auto-populates the Podcasts browse page (Episode/Podcast models — see
// routes/podcasts.ts) for a small, user-curated list of YouTube
// channels/shows. Deliberately separate from podcastDiscovery.ts, which
// polls TrackedShow/ExternalEpisode rows purely to feed search — that
// pipeline never touches the browse page. Everything not listed here stays
// manual via POST /api/admin/episodes, by explicit user choice (2026-09-04).
const POLL_INTERVAL_MS = 30 * 60 * 1000;
const isYouTubeConfigured = Boolean(process.env.YOUTUBE_API_KEY);

interface AutoEpisodeSource {
  podcastId: string;
  youtubeChannelId: string;
  // Only videos whose title matches are added — for a channel that posts a
  // specific show/segment alongside unrelated content it also publishes.
  // Omit to auto-add every upload from the channel.
  titleFilter?: RegExp;
}

const AUTO_SOURCES: AutoEpisodeSource[] = [
  { podcastId: "cmtkwuhlr0000lm779zvqvinr", youtubeChannelId: "UC4uG6XoaVfbDgv6eKq4kkfg" }, // Fox League
  { podcastId: "cmtb4zrap00004pcu82ngdx8n", youtubeChannelId: "UCno_m3ZHdl87IddEWaLRE7A" }, // The Run Home with Joel and Fletch
  { podcastId: "cmthanx5v0002fowh6187a7bn", youtubeChannelId: "UCMEqWpLLlagRDssE_e3qkkA" }, // Levels with Willie Mason & Justin Horo
  { podcastId: "cmtl0ibx00000cek803w0p55u", youtubeChannelId: "UCy79v6dDUKQoNiXZKfo1V_w" }, // Bloke In A Bar
  { podcastId: "cmtatmej90000qe0a6ii7l268", youtubeChannelId: "UCmPb1gSoU_7vFo6grHPZsGQ" }, // Triple M Rocks Footy NRL
  { podcastId: "cmtatmejj0002qe0ae0d2kesv", youtubeChannelId: "UC7vZARXZ-zD42W5aaSewgEw" }, // The Bye Round With James Graham
  // Show-only, not the whole channel: FanaticsTV posts other Kenty content
  // besides the Blitz segment, so only titles naming it are auto-added.
  { podcastId: "cmtatmeji0001qe0a4z9oeyg8", youtubeChannelId: "UCvg1g6ATHoo-d72TBUoI5CA", titleFilter: /kenty.{0,3}s?\s*blitz/i }, // Kenty Blitz
  // 100% Footy publishes across two Nine channels — full episodes on NRL on
  // Nine, short clips on Wide World of Sports — both feed the same podcast
  // bucket, filtered so the rest of each channel's uploads stay manual.
  { podcastId: "cmtiksmfz0000vjugpaxhqeh7", youtubeChannelId: "UCBVrn_SGKAOv3yKPi4Oc3-A", titleFilter: /100%\s*footy/i }, // 100% Footy — full episodes
  { podcastId: "cmtiksmfz0000vjugpaxhqeh7", youtubeChannelId: "UCV5HXUHFR-yuSb7qDJ5_80g", titleFilter: /100%\s*footy/i }, // 100% Footy — clips
  { podcastId: "cmtm5ahtt0000m5uhkwn3dsh2", youtubeChannelId: "UCBVrn_SGKAOv3yKPi4Oc3-A", titleFilter: /^NRL Highlights:/i }, // NRL Highlights — match-highlight uploads only, not every NRL on Nine video
];

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
}

function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

// Same playlistItems.list (cheap, 1 quota unit) uploads-playlist trick as
// podcastDiscovery.ts, but also pulls contentDetails for duration — the
// browse page shows it, ExternalEpisode's search-only rows don't need it.
async function fetchChannelVideos(channelId: string, existingIds: Set<string>): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY!;
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
  const playlistData = (await playlistRes.json()) as { items: { contentDetails: { videoId: string } }[] };

  const newVideoIds = playlistData.items.map((item) => item.contentDetails.videoId).filter((id) => !existingIds.has(id));
  if (newVideoIds.length === 0) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails");
  videosUrl.searchParams.set("id", newVideoIds.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) {
    throw new Error(`YouTube videos.list failed (${videosRes.status}): ${await videosRes.text()}`);
  }
  const videosData = (await videosRes.json()) as {
    items: { id: string; snippet: { title: string; description: string; publishedAt: string }; contentDetails: { duration: string } }[];
  };

  return videosData.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
    durationSeconds: isoDurationToSeconds(v.contentDetails.duration),
  }));
}

export async function pollAutoEpisodeSources(): Promise<void> {
  if (!isYouTubeConfigured) return;

  for (const source of AUTO_SOURCES) {
    try {
      // A manually-added episode (routes/adminEpisodes.ts) stores a random
      // guid, not the real video ID — so dedup can't rely on guid alone or
      // it'll re-add every video someone already pasted in by hand. Extract
      // the video ID out of audioUrl too, for both manual and auto rows.
      const existing = await prisma.episode.findMany({ where: { podcastId: source.podcastId }, select: { guid: true, audioUrl: true } });
      const existingIds = new Set(existing.map((e) => e.guid));
      for (const e of existing) {
        const match = e.audioUrl.match(/(?:[?&]v=|youtu\.be\/)([\w-]{11})/);
        if (match) existingIds.add(match[1]);
      }

      const videos = await fetchChannelVideos(source.youtubeChannelId, existingIds);
      const matching = source.titleFilter ? videos.filter((v) => source.titleFilter!.test(v.title)) : videos;
      if (matching.length === 0) continue;

      for (const v of matching) {
        await prisma.episode.create({
          data: {
            podcastId: source.podcastId,
            guid: v.id,
            title: v.title,
            description: v.description ? v.description.slice(0, 2000) : null,
            audioUrl: `https://www.youtube.com/watch?v=${v.id}`,
            publishedAt: new Date(v.publishedAt),
            durationSeconds: v.durationSeconds,
          },
        });
      }
      console.log(`[episodeAutoPoller] ${source.youtubeChannelId}: added ${matching.length} new episode(s) to podcast ${source.podcastId}`);
    } catch (err) {
      console.error(`[episodeAutoPoller] failed to poll channel ${source.youtubeChannelId}:`, err);
    }
  }
}

export function startEpisodeAutoPolling(): void {
  if (!isYouTubeConfigured) {
    console.log("[episodeAutoPoller] YOUTUBE_API_KEY not set — episode auto-polling disabled");
    return;
  }

  pollAutoEpisodeSources().catch((err) => console.error("[episodeAutoPoller] initial poll failed:", err));
  setInterval(() => {
    pollAutoEpisodeSources().catch((err) => console.error("[episodeAutoPoller] poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log(`[episodeAutoPoller] auto-polling ${AUTO_SOURCES.length} podcast source(s) every ${POLL_INTERVAL_MS / 60000}min`);
}
