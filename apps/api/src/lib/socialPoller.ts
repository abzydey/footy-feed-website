import { TwitterApi } from "twitter-api-v2";

import { prisma } from "./prisma";
import { isTwitterConfigured, getTwitterClient } from "./twitter";
import { notifyFollowersOfEvent } from "./notify";
import { fetchTweetAuthorName } from "./twitterEmbed";

// Comma-separated X usernames to poll, no leading "@". Starts with just the
// app's own account for an end-to-end test; widen later via env, no code
// change needed.
const SOURCE_USERNAMES = (process.env.TWITTER_SOURCE_USERNAMES ?? "centralNRL")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const POLL_INTERVAL_MS = 20 * 60 * 1000;
const RETENTION_MS = 24 * 60 * 60 * 1000;

// Deletes auto-polled posts once they age past RETENTION_MS. Scoped to
// createdBy: "twitter-poller" only — an admin can still paste a tweet URL
// into the admin panel as a manually-curated SOCIAL_POST that's meant to
// stick around, and this must never sweep those up alongside the firehose.
async function pruneOldSocialPosts(): Promise<void> {
  const { count } = await prisma.event.deleteMany({
    where: { type: "SOCIAL_POST", createdBy: "twitter-poller", createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
  });
  if (count > 0) console.log(`[socialPoller] pruned ${count} post(s) older than 24h`);
}

// Username -> user id, resolved once per process rather than on every poll.
const userIdCache = new Map<string, string>();

async function resolveUserId(client: TwitterApi, username: string): Promise<string> {
  const cached = userIdCache.get(username);
  if (cached) return cached;

  const user = await client.v2.userByUsername(username);
  userIdCache.set(username, user.data.id);
  return user.data.id;
}

// Pull each source account's recent tweets and insert any not already seen
// as untargeted SOCIAL_POST events (no teamId/playerId/gameId — same
// "league-wide, not team-specific" shape as GENERAL_NEWS, see schema.prisma
// design notes above the Event model). sourceUrl is the tweet's permalink,
// which both dedupes across polls and gives readers a "view on X" link.
export async function pollTwitterSources(): Promise<void> {
  const client = getTwitterClient();
  if (!client) {
    console.log("[socialPoller] TWITTER_BEARER_TOKEN not set — skipping poll");
    return;
  }

  for (const username of SOURCE_USERNAMES) {
    try {
      const userId = await resolveUserId(client, username);
      // Reposts (X API type "retweeted") are included now — excluding them
      // was why they weren't showing up. A repost's own tweet object only
      // carries a truncated "RT @handle: ..." stub of the original, so the
      // two expansions below resolve it to the real original tweet's full
      // text + author instead of posting that mangled stub.
      const timeline = await client.v2.userTimeline(userId, {
        max_results: 10,
        exclude: ["replies"],
        expansions: ["referenced_tweets.id", "referenced_tweets.id.author_id"],
        "tweet.fields": ["referenced_tweets", "created_at"],
      });

      for (const tweet of timeline.tweets) {
        const retweetRef = tweet.referenced_tweets?.find((r) => r.type === "retweeted");

        // A plain original post (or a quote-tweet, which already carries its
        // own real commentary as `text`) — same as before.
        let text = tweet.text;
        let authorUsername = username;
        let authorName: string | null = null;
        let tweetId = tweet.id;
        let postedAt = tweet.created_at;

        if (retweetRef) {
          const original = timeline.includes.tweets?.find((t) => t.id === retweetRef.id);
          const originalAuthor = original && timeline.includes.users?.find((u) => u.id === original.author_id);
          // Couldn't resolve the original (deleted/protected since the
          // repost) — skip rather than post the truncated "RT @..." stub.
          if (!original || !originalAuthor) continue;
          text = original.text;
          authorUsername = originalAuthor.username;
          authorName = originalAuthor.name;
          tweetId = original.id;
          postedAt = original.created_at ?? postedAt;
        }

        // Attributed to whoever actually wrote it (not @centralNRL) so a
        // reposted tweet renders exactly like an original post from that
        // account — same headline/name/handle pairing either way.
        const sourceUrl = `https://x.com/${authorUsername}/status/${tweetId}`;

        // Social is meant to feel live, not become a growing archive — skip
        // anything older than 24h. Matters most the first time a new
        // account gets added to SOURCE_USERNAMES: that account's first poll
        // pulls its 10 most recent tweets regardless of age, which for a
        // quieter account could span days or weeks.
        if (postedAt && Date.now() - new Date(postedAt).getTime() > RETENTION_MS) continue;

        const existing = await prisma.event.findFirst({ where: { sourceUrl } });
        if (existing) continue;

        // headline is the author/handle line, body is the post text — see
        // schema.prisma design notes above the Event model. (Previously both
        // held the tweet text, which is what caused the on-card duplication.)
        if (!retweetRef) authorName = await fetchTweetAuthorName(sourceUrl);

        const event = await prisma.event.create({
          data: {
            type: "SOCIAL_POST",
            headline: `@${authorUsername}`,
            body: text,
            sourceUrl,
            sourceName: `@${authorUsername}`,
            sourceAuthor: authorName ?? undefined,
            createdBy: "twitter-poller",
            // Defaults to insertion time if omitted — fine when polling
            // trickles in a couple of new posts at a time, but wrong the
            // moment a poll backfills several accounts' recent tweets in
            // one run: every row would get ~the same "now" timestamp, so
            // the feed's createdAt-desc sort would reflect account-loop
            // order instead of actual recency. Uses the tweet's own postal
            // time instead, so cross-account ordering is correct even on a
            // multi-account bulk pull.
            createdAt: postedAt ? new Date(postedAt) : undefined,
          },
        });

        // Fire-and-forget, same pattern as routes/events.ts — an untargeted
        // post has no team/player to fan out to, so this is a no-op today,
        // but keeps behavior consistent if that ever changes.
        notifyFollowersOfEvent(event.id).catch((err) =>
          console.error(`[socialPoller] notifyFollowersOfEvent failed for event ${event.id}:`, err)
        );
      }
    } catch (err) {
      console.error(`[socialPoller] failed to poll @${username}:`, err);
    }
  }

  await pruneOldSocialPosts().catch((err) => console.error("[socialPoller] prune failed:", err));
}

export function startTwitterPoller(): void {
  if (!isTwitterConfigured) {
    console.log("[socialPoller] TWITTER_BEARER_TOKEN not set — X polling disabled");
    return;
  }

  pollTwitterSources().catch((err) => console.error("[socialPoller] initial poll failed:", err));
  setInterval(() => {
    pollTwitterSources().catch((err) => console.error("[socialPoller] poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log(`[socialPoller] polling ${SOURCE_USERNAMES.map((u) => `@${u}`).join(", ")} every 20 min`);
}
