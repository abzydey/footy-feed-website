import { prisma } from "./prisma";
import { isTwitterConfigured, getTwitterClient } from "./twitter";

// The live-blog account(s) to read scores from — distinct from
// SOURCE_USERNAMES in socialPoller.ts, which feeds the app's own Social
// page. This is read-only structured-data extraction, not content to
// display as a post. Comma-separated, no leading "@".
const LIVE_SCORE_USERNAMES = (process.env.LIVE_SCORE_TWITTER_USERNAMES ?? "LeagueUnlimited")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const POLL_INTERVAL_MS = 2.5 * 60 * 1000;

// A game only needs live-score polling within roughly its own playing
// window — checking every account's tweets on every tick regardless of
// whether anything's actually on would burn API budget for nothing. A game
// is "in the live-score window" from just before its scheduled kickoff
// (tweets can start flowing — team news, "kick-off imminent" — slightly
// early) through a few hours after (covers full time + any stoppage/replay
// delay before the real result gets logged).
const WINDOW_BEFORE_KICKOFF_MS = 15 * 60 * 1000;
const WINDOW_AFTER_KICKOFF_MS = 3.5 * 60 * 60 * 1000;

// Maps a club's tracked X handle (lowercase, no @) to its Team.slug — the
// same 17 handles already tracked in socialPoller.ts's SOURCE_USERNAMES,
// reused here so a tweet's "@NRL_Bulldogs 20 / @brisbanebroncos 34" score
// line can be matched to the real Team rows rather than just trusted at
// face value.
const HANDLE_TO_TEAM_SLUG: Record<string, string> = {
  brisbanebroncos: "broncos",
  raiderscanberra: "raiders",
  nrl_bulldogs: "bulldogs",
  cronullasharks: "sharks",
  dolphinsnrl: "dolphins",
  gctitans: "titans",
  seaeagles: "sea-eagles",
  storm: "storm",
  nzwarriors: "warriors",
  nrlknights: "knights",
  nthqldcowboys: "cowboys",
  theparraeels: "eels",
  penrithpanthers: "panthers",
  ssfcrabbitohs: "rabbitohs",
  nrl_dragons: "dragons",
  sydneyroosters: "roosters",
  weststigers: "wests-tigers",
};

interface ParsedScoreTweet {
  minute: string | null;
  scoreBySlug: Map<string, number>;
}

// Matches lines like "@NRL_Bulldogs 20" — every scoring-event tweet from
// the tracked live-blog account carries exactly two of these (one per
// team), which is what makes a tweet a genuine score update rather than
// commentary (sin bin, crowd size, halftime recap, retweets, etc.) that
// happens to mention a club. Requires both handles to resolve to a known
// club — an unrecognised handle means this isn't a score line we can trust,
// so the whole tweet is skipped rather than guessed at.
export function parseScoreTweet(text: string): ParsedScoreTweet | null {
  // "@handle NN" appearing twice is necessary but not sufficient — a
  // retweet or unrelated post that happens to mention two clubs with
  // nearby numbers (a date, a crowd figure, an unrelated stat) would
  // otherwise false-positive. Every real score-line tweet from the tracked
  // live-blog account also links its own live blog, so requiring that
  // phrase is a cheap, reliable way to confirm this is actually one of
  // their structured score updates and not incidental.
  if (!/live blog/i.test(text)) return null;

  const matches = [...text.matchAll(/@(\w+)\s+(\d{1,3})\b/g)];
  if (matches.length !== 2) return null;

  const scoreBySlug = new Map<string, number>();
  for (const [, handle, scoreStr] of matches) {
    const slug = HANDLE_TO_TEAM_SLUG[handle.toLowerCase()];
    if (!slug) return null; // not a recognised club handle — don't trust this as a score line
    scoreBySlug.set(slug, Number(scoreStr));
  }
  if (scoreBySlug.size !== 2) return null; // same team mentioned twice, or some other malformed case

  const minuteMatch = text.match(/^(\d{1,3}')/);
  return { minute: minuteMatch ? minuteMatch[1] : null, scoreBySlug };
}

export async function pollLiveScores(): Promise<void> {
  const now = new Date();
  const candidates = await prisma.game.findMany({
    where: {
      status: { not: "FULL_TIME" },
      kickoffAt: {
        gte: new Date(now.getTime() - WINDOW_AFTER_KICKOFF_MS),
        lte: new Date(now.getTime() + WINDOW_BEFORE_KICKOFF_MS),
      },
    },
    include: { homeTeam: true, awayTeam: true },
  });
  if (candidates.length === 0) return; // nothing in-window — skip the API call entirely

  const client = getTwitterClient();
  if (!client) return;

  for (const username of LIVE_SCORE_USERNAMES) {
    try {
      const user = await client.v2.userByUsername(username);
      const timeline = await client.v2.userTimeline(user.data.id, {
        max_results: 20,
        exclude: ["replies"],
      });

      for (const game of candidates) {
        const homeSlug = game.homeTeam.slug;
        const awaySlug = game.awayTeam.slug;

        // Tweets come back newest-first — the first one that mentions both
        // of this game's teams with a valid score pair is the latest known
        // state, so later (older) tweets for the same game are ignored.
        const latest = timeline.tweets
          .map((t) => parseScoreTweet(t.text))
          .find((parsed) => parsed && parsed.scoreBySlug.has(homeSlug) && parsed.scoreBySlug.has(awaySlug));
        if (!latest) continue;

        const homeScore = latest.scoreBySlug.get(homeSlug)!;
        const awayScore = latest.scoreBySlug.get(awaySlug)!;
        if (game.homeScore === homeScore && game.awayScore === awayScore && game.liveClock === latest.minute) {
          continue; // already reflects this state — no-op update avoided
        }

        await prisma.game.update({
          where: { id: game.id },
          data: { homeScore, awayScore, liveClock: latest.minute, status: "LIVE" },
        });
        console.log(
          `[liveScorePoller] ${game.homeTeam.shortName} ${homeScore}-${awayScore} ${game.awayTeam.shortName}${
            latest.minute ? ` (${latest.minute})` : ""
          } — from @${username}`
        );
      }
    } catch (err) {
      console.error(`[liveScorePoller] failed to poll @${username}:`, err);
    }
  }
}

export function startLiveScorePolling(): void {
  if (!isTwitterConfigured) {
    console.log("[liveScorePoller] TWITTER_BEARER_TOKEN not set — live-score polling disabled");
    return;
  }

  pollLiveScores().catch((err) => console.error("[liveScorePoller] initial poll failed:", err));
  setInterval(() => {
    pollLiveScores().catch((err) => console.error("[liveScorePoller] poll failed:", err));
  }, POLL_INTERVAL_MS);

  console.log(`[liveScorePoller] watching ${LIVE_SCORE_USERNAMES.map((u) => `@${u}`).join(", ")} for live scores, checking every ${POLL_INTERVAL_MS / 60000}min when a game is in-window`);
}
