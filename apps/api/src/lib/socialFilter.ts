// Keeps promotional posts (merch, tickets, memberships, sponsors, birthday
// posts…) off the Social page. Club accounts post a lot of these alongside
// their real news. A post is filtered only if it matches a promo phrase AND
// none of the news phrases — so "X signs a new deal — memberships on sale
// now" still shows. Edit the lists to tune it; matching is case-insensitive
// on whole words/phrases.
//
// This hides posts but doesn't save X credit (they've already been read) —
// dropping an account from TWITTER_SOURCE_USERNAMES is what saves credit.

const PROMO_PHRASES = [
  "tickets",
  "ticket",
  "ticketing",
  "merch",
  "merchandise",
  "membership",
  "memberships",
  "become a member",
  "giveaway",
  "give away",
  "chance to win",
  "enter to win",
  "enter now",
  "presented by",
  "proudly supported by",
  "official partner",
  "in partnership with",
  "% off",
  "on sale",
  "sale ends",
  "pre-order",
  "preorder",
  "shop now",
  "shop the",
  "available now",
  "available in store",
  "link in bio",
  "use code",
  "promo code",
  "discount",
  "happy birthday",
  "hospitality",
  "book now",
  "buy now",
  "grab your",
  "limited edition",
  "season pass",
];

const NEWS_PHRASES = [
  "sign",
  "signs",
  "signed",
  "signing",
  "re-sign",
  "re-signs",
  "re-signed",
  "extends",
  "extension",
  "contract",
  "injury",
  "injured",
  "injuries",
  "ruled out",
  "suspended",
  "suspension",
  "named",
  "team list",
  "squad",
  "debut",
  "retire",
  "retires",
  "retirement",
  "coach",
  "captain",
  "released",
  "release",
  "joins",
  "scans",
  "surgery",
  "judiciary",
  "charged",
  "breaking",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\%]/g, "\\$&");
// "% off" starts with a non-word character, so it can't use a \b boundary.
const toRegex = (phrases: string[]) =>
  new RegExp(phrases.map((p) => (/^\w/.test(p) ? `\\b${escape(p)}\\b` : `${escape(p)}\\b`)).join("|"), "i");

const PROMO = toRegex(PROMO_PHRASES);
const NEWS = toRegex(NEWS_PHRASES);

// The promo phrase that caught it, or null if the post should show.
export function promotionalMatch(text: string): string | null {
  const promo = text.match(PROMO);
  if (!promo) return null;
  if (NEWS.test(text)) return null; // real news that happens to mention a promo — keep
  return promo[0];
}
