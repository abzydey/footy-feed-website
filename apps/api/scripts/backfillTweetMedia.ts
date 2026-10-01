// One-off: fills Event.media on SOCIAL_POST rows saved before the poller
// started requesting media (see lib/tweetMedia.ts), and strips their
// now-redundant media t.co links from the body. Safe to re-run — rows that
// already have media are skipped. Run with tsx from apps/api:
//
//   npx tsx scripts/backfillTweetMedia.ts
import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma";
import { getTwitterClient } from "../src/lib/twitter";
import { extractTweetMedia, stripMediaLinks, TWEET_MEDIA_PARAMS } from "../src/lib/tweetMedia";

async function main() {
  const client = getTwitterClient();
  if (!client) throw new Error("TWITTER_BEARER_TOKEN not set");

  const posts = await prisma.event.findMany({
    where: { type: "SOCIAL_POST", media: { equals: Prisma.DbNull } },
    select: { id: true, sourceUrl: true, body: true },
  });
  const byTweetId = new Map<string, (typeof posts)[number]>();
  for (const p of posts) {
    const id = p.sourceUrl?.match(/status\/(\d+)/)?.[1];
    if (id) byTweetId.set(id, p);
  }
  console.log(`${byTweetId.size} posts without media to check`);

  const ids = [...byTweetId.keys()];
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const res = await client.v2.tweets(ids.slice(i, i + 100), {
      expansions: ["attachments.media_keys"],
      "tweet.fields": ["attachments", "entities"],
      ...TWEET_MEDIA_PARAMS,
    });
    for (const tweet of res.data ?? []) {
      const media = extractTweetMedia(tweet, res.includes?.media);
      if (!media.length) continue;
      const post = byTweetId.get(tweet.id)!;
      await prisma.event.update({
        where: { id: post.id },
        data: {
          media: media as unknown as Prisma.InputJsonValue,
          body: post.body ? stripMediaLinks(post.body, tweet) : post.body,
        },
      });
      updated++;
      console.log(`  ${post.sourceUrl}: ${media.map((m) => m.type).join(", ")}`);
    }
  }
  console.log(`Added media to ${updated} posts`);
}


main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
