import { EventItem } from "./api";

// A story that needs to appear more than once in Event terms — either
// because it's tagged to more than one team (e.g. a signing tagged to both
// the club a player is leaving and the one they're joining) or because it
// also has a separate GENERAL_NEWS copy for the dedicated News page — ends
// up as multiple Event rows sharing one headline/sourceUrl. Each row is
// exactly right for a single team's page, but any list that merges across
// teams/types (Top/My Teams/Signing News) would show the same story back
// to back as an apparent duplicate. Collapses that down to one card per
// real story, keeping the first (newest, since the feed is already sorted)
// occurrence. Shared between HomePage's own preview carousel and FeedPage's
// full "Top"/"My Teams"/"Signing News" pages so the two can't drift apart.
//
// Keyed on sourceUrl+headline together, not sourceUrl alone: a single
// wrap-up article (e.g. Code Sports' "Sport Confidential" column) can carry
// several genuinely separate stories under one shared URL, and keying on
// sourceUrl alone would wrongly collapse those into one.
export function dedupeStories(items: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceUrl ?? ""}::${item.headline}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The last full feed (GET /feed) this device loaded, so Home and News can
// show stories straight away on the next open — and be their full height
// immediately when you come back to them (see scrollRestoration.ts) —
// while the fresh copy loads. Storage can be unavailable (private mode,
// cleared site data), so both helpers quietly do nothing then.
const FEED_CACHE_KEY = "fullset.homeFeed";

export function readCachedFeed(): EventItem[] | null {
  try {
    const raw = localStorage.getItem(FEED_CACHE_KEY);
    return raw ? (JSON.parse(raw) as EventItem[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedFeed(feed: EventItem[]): void {
  try {
    localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feed));
  } catch {
    // storage full or blocked — the cache is only a convenience
  }
}
