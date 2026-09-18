import { prisma } from "./prisma";
import { discoverNewEpisodesForShow, isSpotifyDiscoveryConfigured, isYouTubeDiscoveryConfigured } from "./podcastDiscovery";

// Podcast episodes publish far less often than tweets — an hour is plenty
// fresh without wasting quota (see podcastDiscovery.ts on why
// playlistItems.list keeps this cheap regardless of interval). Widened from
// 30min (2026-09-18) alongside the other background pollers — several
// independent ones on similar cadences were keeping Neon's compute
// effectively always-on, never idle long enough to auto-suspend, burning
// through the monthly CU-hour allowance early. A new episode taking up to
// an hour longer to appear is a real but low-stakes tradeoff here.
const POLL_INTERVAL_MS = 60 * 60 * 1000;

export async function pollTrackedShows(): Promise<void> {
  const shows = await prisma.trackedShow.findMany();
  for (const show of shows) {
    try {
      const inserted = await discoverNewEpisodesForShow(show);
      if (inserted > 0) {
        console.log(`[podcastDiscovery] ${show.name}: indexed ${inserted} new episode(s)`);
      }
    } catch (err) {
      console.error(`[podcastDiscovery] failed to poll "${show.name}":`, err);
    }
  }
}

export function startPodcastDiscoveryPoller(): void {
  if (!isYouTubeDiscoveryConfigured && !isSpotifyDiscoveryConfigured) {
    console.log("[podcastDiscovery] YOUTUBE_API_KEY / SPOTIFY_CLIENT_ID+SECRET not set — discovery disabled");
    return;
  }

  pollTrackedShows().catch((err) => console.error("[podcastDiscovery] initial poll failed:", err));
  setInterval(() => {
    pollTrackedShows().catch((err) => console.error("[podcastDiscovery] poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log(
    `[podcastDiscovery] polling tracked shows every 30 min (YouTube: ${isYouTubeDiscoveryConfigured ? "on" : "off"}, Spotify: ${isSpotifyDiscoveryConfigured ? "on" : "off"})`
  );
}
