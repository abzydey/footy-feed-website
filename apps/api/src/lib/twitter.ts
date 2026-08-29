import { TwitterApi } from "twitter-api-v2";

// Mirrors lib/firebase.ts's isFirebaseAdminConfigured pattern: degrades
// gracefully to "not configured" until TWITTER_BEARER_TOKEN is set, so a
// fresh clone without X API credentials still runs — socialPoller.ts just
// skips polling instead of crashing.
export const isTwitterConfigured = Boolean(process.env.TWITTER_BEARER_TOKEN);

let client: TwitterApi | undefined;

// Read-only app-level auth (Bearer Token) — all the poller needs. The
// Consumer Key/Secret and Access Token/Secret are also captured in .env for
// a future posting feature, but aren't used here.
export function getTwitterClient(): TwitterApi | undefined {
  if (!isTwitterConfigured) return undefined;

  if (!client) {
    client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN!);
  }
  return client;
}
