// Fetches the real author display name for a tweet from X's public oEmbed
// endpoint (publish.twitter.com — free, unauthenticated, no API credentials/
// credits involved; unrelated to lib/twitter.ts's app-auth client used for
// polling). Social cards are our own custom-rendered card (see
// EventCard.tsx), not X's real embed widget, so author_name is the one
// piece of that response worth keeping — it's the real display name
// ("NRLCentral") the poller/admin flow otherwise has no way to know,
// only the handle.
export async function fetchTweetAuthorName(tweetUrl: string): Promise<string | null> {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;

    const data = (await res.json()) as { author_name?: string };
    return data.author_name ?? null;
  } catch (err) {
    console.error(`[twitterEmbed] failed to fetch oEmbed for ${tweetUrl}:`, err);
    return null;
  }
}
