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
