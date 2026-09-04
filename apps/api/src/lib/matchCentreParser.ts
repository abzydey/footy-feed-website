// Scrapes NRL.com's official match-centre page — the primary live-score
// source (see lib/liveScorePoller.ts), with the @LeagueUnlimited tweet
// parser demoted to a fallback for whenever this isn't reachable. Same
// "plain fetch, real browser User-Agent" approach as lib/lateMailParser.ts
// (confirmed: no real login wall on this page either — the "Log In" nav
// link doesn't gate the match data). Proven directly against a real live
// game (2026-09-04): NRL.com's own page showed a score two tries ahead of
// what @LeagueUnlimited had tweeted, which had gone quiet for ~40 minutes.
//
// Unlike the tweet parser, there's no never-regress guard here — this is
// the official record, not a third party's manual typing, so a decrease
// (a genuine bunker overturn corrected at the source) is trusted directly
// rather than treated as suspicious.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface MatchCentreData {
  matchMode: "Pre" | "Live" | "Post" | string;
  matchState: string;
  gameSeconds: number;
  homeScore: number;
  awayScore: number;
  updated: string;
}

// /draw/nrl-premiership/{year}/round-{n}/{home-slug}-v-{away-slug}/ —
// confirmed against every real Round 27 fixture's own /draw/ link on the
// Late Mail page: every slug matched this app's Team.slug exactly, no
// translation needed. Returns null for a round with no plain number
// (finals rounds like "Grand Final") — that's a real gap, not a bug to
// paper over with a guess; the poller falls back to tweets for those.
export function buildMatchCentreUrl(game: {
  round: string;
  kickoffAt: Date;
  homeTeam: { slug: string };
  awayTeam: { slug: string };
}): string | null {
  const roundMatch = game.round.match(/(\d+)/);
  if (!roundMatch) return null;
  const year = game.kickoffAt.getUTCFullYear();
  return `https://www.nrl.com/draw/nrl-premiership/${year}/round-${roundMatch[1]}/${game.homeTeam.slug}-v-${game.awayTeam.slug}/`;
}

// The entire match state — score, live clock (as gameSeconds), status,
// full play-by-play timeline, try scorers with exact minutes — is one JSON
// blob in a single HTML attribute: <div id="vue-match-centre"
// q-data="{...}">. No DOM traversal needed at all (simpler than Late
// Mail's cheerio work), just decode the HTML entities in that one
// attribute and JSON.parse it.
export async function fetchMatchCentre(url: string): Promise<MatchCentreData> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_USER_AGENT } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  const html = await res.text();

  const attrMatch = html.match(/id="vue-match-centre" q-data="([^"]*)"/);
  if (!attrMatch) throw new Error(`vue-match-centre q-data attribute not found at ${url}`);

  const decoded = attrMatch[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const data = JSON.parse(decoded);

  return {
    matchMode: data.match.matchMode,
    matchState: data.match.matchState,
    gameSeconds: data.match.gameSeconds,
    homeScore: data.match.homeTeam.score,
    awayScore: data.match.awayTeam.score,
    updated: data.match.updated,
  };
}
