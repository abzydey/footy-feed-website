import { prisma } from "./prisma";
import { fetchLateMail, findLatestLateMailUrl } from "./lateMailParser";
import { analyzeLateMail, generateTwentyFourHourBody, AnalyzedSide, Stage } from "./lateMailAnalysis";
import { notifyFollowersOfEvent } from "./notify";
import { sendAdminAlert } from "./adminAlert";

// Automatic version of the chat/admin-panel-triggered Late Mail flow (see
// routes/adminLateMail.ts) — same fetch + analyze pipeline (lib/lateMailAnalysis.ts),
// just run on a timer and auto-publishing instead of waiting for a human to
// review and approve in chat first. Built after a run of manual Late Mail
// checks this session all came back clean, and the user asked to stop being
// asked every time — then extended to cover TWENTY_FOUR_HOUR too ("Yes all
// updates i want automatic") once generateTwentyFourHourBody (see
// lateMailAnalysis.ts) could template the common cases (a plain reserve
// trim, a reserve promoted onto the bench) that account for nearly every
// real 24hr update seen this season. It still refuses to guess at a genuine
// starting-lineup change — that needs real football judgment a template
// can't fabricate — and falls back to being flagged for manual/chat
// write-up, same treatment as a shape warning.
// Widened from 20 to 60min (2026-09-18): this generic sweep is only a
// safety net for INITIAL (no per-game anchor) and for anything that slips
// past its own precise scheduled check below — the exact-timing case is
// already covered by scheduleUpcomingChecks()'s per-game setTimeout, fired
// 5min after each game's real 24hr/Final release. A background poller this
// frequent, alongside several other independent ones on similar cadences,
// was keeping Neon's compute effectively always-on (no gap long enough to
// auto-suspend) and burning through the monthly CU-hour allowance well
// before month's end — this trades a wider worst-case detection window for
// a real edge case (a scheduled check's own fetch failing, say) against
// meaningfully more idle time between cycles.
const POLL_INTERVAL_MS = 60 * 60 * 1000;

// The two checkpoints have a real, computable kickoff-relative expectation
// (same offsets TeamListCard.tsx's PLACEHOLDER_OFFSET_MS assumes: ~24h and
// ~90min before kickoff) — INITIAL doesn't, it's a league-wide Tuesday
// release with no per-game anchor, so it just rides the generic interval
// below. Checking exactly at the expected moment risks polling a beat
// before NRL.com has actually published — CHECK_BUFFER_MS waits 5 minutes
// past it instead, so a 7:35pm kickoff's Final check fires at 6:10pm
// (90min - 5min = 85min before kickoff), not 6:05pm. Widened from an
// initial 2min buffer, still on top of the generic interval as a
// safety net.
const TWENTY_FOUR_HOUR_OFFSET_MS = 24 * 60 * 60 * 1000;
const FINAL_OFFSET_MS = 90 * 60 * 1000;
const CHECK_BUFFER_MS = 5 * 60 * 1000;

// Dedup state so a shape-warning or unmatched-team problem that isn't going
// away doesn't get re-logged every single poll cycle — only worth a fresh
// log line when the underlying warning signature actually changes (or a
// previously-broken one clears).
const lastWarningSignature = new Map<string, string>();

function logIfChanged(key: string, signature: string, message: string): void {
  if (lastWarningSignature.get(key) === signature) return;
  lastWarningSignature.set(key, signature);
  if (message) console.log(message);
}

// Error-level twin of logIfChanged, for the "poller is silently doing
// nothing" failures — logged once per distinct problem, cleared by passing
// signature "ok" with an empty message once things are healthy again.
function warnOnce(key: string, signature: string, message: string): boolean {
  if (lastWarningSignature.get(key) === signature) return false;
  lastWarningSignature.set(key, signature);
  if (message) console.error(message);
  return !!message;
}

function buildHeadline(shortName: string, round: string, stage: Stage): string {
  if (stage === "FINAL") return `${shortName} Final Team List: ${round}`;
  if (stage === "TWENTY_FOUR_HOUR") return `24-hour team update: ${shortName}`;
  return `${shortName} ${round} team list`;
}

async function upsertEvent(side: AnalyzedSide, round: string, stage: Stage, body: string): Promise<void> {
  const existing = await prisma.event.findFirst({
    where: { gameId: side.matchedGameId!, teamId: side.matchedTeamId!, type: "LINEUP_CHANGE", teamListStage: stage },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.body === body) return; // already up to date
    await prisma.event.update({ where: { id: existing.id }, data: { body } });
    console.log(`[lateMailPoller] updated ${side.matchedTeamShortName} ${stage} team list (changed since last check)`);
    return;
  }

  const event = await prisma.event.create({
    data: {
      type: "LINEUP_CHANGE",
      teamId: side.matchedTeamId!,
      gameId: side.matchedGameId!,
      teamListStage: stage,
      headline: buildHeadline(side.matchedTeamShortName!, round, stage),
      body,
      createdBy: "late-mail-poller",
    },
  });
  console.log(`[lateMailPoller] published ${side.matchedTeamShortName} ${stage} team list`);
  notifyFollowersOfEvent(event.id).catch((err) => console.error(`[lateMailPoller] notifyFollowersOfEvent failed for ${event.id}:`, err));
}

async function publishInitialOrFinal(side: AnalyzedSide, round: string, stage: "INITIAL" | "FINAL"): Promise<void> {
  const key = `${side.matchedGameId}|${side.matchedTeamId}|${stage}`;

  if (side.shapeWarnings.length > 0) {
    logIfChanged(
      key,
      side.shapeWarnings.join("; "),
      `[lateMailPoller] ${side.matchedTeamShortName} ${stage} needs review, not auto-publishing: ${side.shapeWarnings.join(", ")}`
    );
    return;
  }
  logIfChanged(key, "clean", ""); // clears any prior warning signature silently once the shape is fixed
  await upsertEvent(side, round, stage, side.generatedBody);
}

async function publishTwentyFourHour(side: AnalyzedSide, opponentShortName: string, round: string, kickoffAt: Date): Promise<void> {
  const key = `${side.matchedGameId}|${side.matchedTeamId}|TWENTY_FOUR_HOUR`;

  if (side.shapeWarnings.length > 0) {
    logIfChanged(
      key,
      side.shapeWarnings.join("; "),
      `[lateMailPoller] ${side.matchedTeamShortName} 24hr needs review, not auto-publishing: ${side.shapeWarnings.join(", ")}`
    );
    return;
  }

  const result = generateTwentyFourHourBody(side, opponentShortName, kickoffAt);
  if (!result.body) {
    logIfChanged(
      key,
      `needs-writeup:${result.reason}`,
      `[lateMailPoller] ${side.matchedTeamShortName} 24hr needs a hand-written update, not auto-publishing: ${result.reason}`
    );
    return;
  }
  logIfChanged(key, "clean", "");
  await upsertEvent(side, round, "TWENTY_FOUR_HOUR", result.body);
}

// NRL is an Australian competition run out of Sydney — Late Mail articles
// get written/updated during Australian business hours and around
// matchdays, never in the middle of the Australian night. No point hitting
// nrl.com every 20min through that dead window just to find nothing's
// changed. Intl's timeZone lookup handles AEST/AEDT daylight saving
// automatically, unlike a fixed UTC offset.
function isQuietHours(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  return hour < 6; // midnight-6am AEST/AEDT
}

// The same article stays live-updated by NRL.com across the whole round
// (Tuesday's Initial through Sunday's Final), but nrl.com/news/'s own
// listing moves on well before that — it dropped this round's Late Mail
// article days before Sunday's games even kicked off, which meant
// findLatestLateMailUrl() started returning null while the article itself
// was still perfectly live and current. Caching the last URL that actually
// worked and falling back to it here is what keeps the poller running
// through that gap instead of going silent (see the missed Dragons v Eels
// Final check this caused — "Can't see the eels dragons team list
// updated").
// In-memory only (resets on deploy) — the durable source is the pinned URL
// in AppSetting. This used to be a hardcoded per-round seed, which went
// stale and silently pointed the poller at last week's article for the
// whole Preliminary Finals round; the DB pin replaced it.
let lastKnownUrl: string | null = null;

export const PINNED_URL_KEY = "lateMail.pinnedUrl";

// Fetches + analyzes one candidate URL; returns null (with a reason) if it
// can't be used for the games actually coming up. Reading the wrong week's
// article isn't an error on its own — it just matches finished games and
// finds nothing to do, which is how the Preliminary Finals miss went
// unnoticed for days — so "covers at least one upcoming game" is the real
// test of a usable article, not just "fetched and parsed."
async function tryCandidate(url: string, upcomingCount: number) {
  let lateMail;
  try {
    lateMail = await fetchLateMail(url);
  } catch (err) {
    return { ok: false as const, reason: `fetch/parse failed (${err instanceof Error ? err.message : err})` };
  }
  if (!lateMail.round) return { ok: false as const, reason: "no round heading found" };

  const matches = await analyzeLateMail(lateMail);
  if (upcomingCount > 0) {
    const matchedIds = [...new Set(matches.flatMap((m) => [m.home.matchedGameId, m.away.matchedGameId]))].filter(
      (id): id is string => !!id
    );
    const covered = matchedIds.length
      ? await prisma.game.count({ where: { id: { in: matchedIds }, status: "SCHEDULED", kickoffAt: { gt: new Date() } } })
      : 0;
    if (covered === 0) return { ok: false as const, reason: `"${lateMail.round}" covers none of the upcoming games` };
  }
  return { ok: true as const, round: lateMail.round, matches };
}

export async function pollLateMail(): Promise<void> {
  if (isQuietHours()) return;

  // Priority order: the link the user sends each Tuesday (stored in the DB
  // via scripts/setLateMailUrl.ts, so it survives redeploys — NRL.com
  // live-updates that one page Initial → 24hr → Final, and a fresh one is
  // used every week), then nrl.com/news/ discovery, then whatever last
  // worked in this process. First candidate that actually covers an
  // upcoming game wins.
  const pinned = (await prisma.appSetting.findUnique({ where: { key: PINNED_URL_KEY } }))?.value ?? null;
  const discovered = await findLatestLateMailUrl().catch((err) => {
    console.warn("[lateMailPoller] failed to check nrl.com/news/ for the current Late Mail article:", err);
    return null;
  });
  const candidates = [...new Set([pinned, discovered, lastKnownUrl].filter((u): u is string => !!u))];

  const now = new Date();
  const upcomingCount = await prisma.game.count({
    where: { status: "SCHEDULED", kickoffAt: { gt: now, lte: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000) } },
  });

  let chosen: { url: string; round: string; matches: Awaited<ReturnType<typeof analyzeLateMail>> } | null = null;
  const rejected: string[] = [];
  for (const url of candidates) {
    const result = await tryCandidate(url, upcomingCount);
    if (result.ok) {
      chosen = { url, round: result.round, matches: result.matches };
      break;
    }
    rejected.push(`${url} — ${result.reason}`);
  }

  if (!chosen) {
    const isNew = warnOnce(
      "stale-article",
      rejected.join(" | ") || "none",
      `[lateMailPoller] STALE: no usable team-list article for the ${upcomingCount} upcoming game(s) — team lists are NOT being updated. ` +
        `Send this week's NRL.com team-list link (pin it with scripts/setLateMailUrl.ts). Tried: ${rejected.join(" | ") || "nothing (no candidate URLs)"}`
    );
    if (isNew) {
      await sendAdminAlert(
        "⚠️ Team lists aren't updating",
        `Full Set can't find this week's NRL.com team-list page for ${upcomingCount} upcoming game(s). Send Claude this week's team-list link.`
      );
    }
    return;
  }
  warnOnce("stale-article", "ok", "");
  if (pinned && chosen.url !== pinned) {
    logIfChanged("pin-skipped", chosen.url, `[lateMailPoller] pinned URL doesn't cover upcoming games — using ${chosen.url} instead`);
  }
  lastKnownUrl = chosen.url;
  const { matches } = chosen;
  const lateMail = { round: chosen.round };

  for (const match of matches) {
    for (const [side, opponent] of [
      [match.home, match.away],
      [match.away, match.home],
    ] as const) {
      if (!side.matchedTeamId || !side.matchedGameId) {
        logIfChanged(
          `unmatched|${match.matchLabel}|${side.rawTeamName}`,
          "unmatched",
          `[lateMailPoller] couldn't match "${side.rawTeamName}" in "${match.matchLabel}" to a known team/game — skipping`
        );
        continue;
      }

      try {
        if (side.suggestedStage === "TWENTY_FOUR_HOUR") {
          const game = await prisma.game.findUnique({ where: { id: side.matchedGameId } });
          if (game) await publishTwentyFourHour(side, opponent.matchedTeamShortName ?? opponent.rawTeamName, lateMail.round, game.kickoffAt);
        } else {
          await publishInitialOrFinal(side, lateMail.round, side.suggestedStage);
        }
      } catch (err) {
        console.error(`[lateMailPoller] failed publishing ${side.matchedTeamShortName} (${side.suggestedStage}):`, err);
      }
    }
  }
}

// Games don't move kickoff times often once scheduled, so a per-game
// setTimeout scheduled once (and re-armed periodically to pick up newly
// added fixtures) is simpler and more precise than trying to guess the
// right moment from the generic interval alone — which is exactly what let
// Cowboys v Raiders' Final update sit unpublished for part of a cycle
// ("How come the final update for raiders vs cowboys wasnt updated 2 mins
// ago"). The generic interval keeps running underneath as a safety net for
// INITIAL (no per-game anchor) and for anything that slips past its exact
// predicted moment.
const scheduledChecks = new Set<string>();

async function scheduleUpcomingChecks(): Promise<void> {
  const now = Date.now();
  const games = await prisma.game.findMany({
    where: { status: "SCHEDULED", kickoffAt: { gte: new Date(now), lte: new Date(now + 8 * 24 * 60 * 60 * 1000) } },
  });

  for (const game of games) {
    const kickoff = game.kickoffAt.getTime();
    for (const [stage, offset] of [
      ["24hr", TWENTY_FOUR_HOUR_OFFSET_MS],
      ["Final", FINAL_OFFSET_MS],
    ] as const) {
      const key = `${game.id}|${stage}`;
      if (scheduledChecks.has(key)) continue;

      const delay = kickoff - offset + CHECK_BUFFER_MS - now;
      if (delay <= 0 || delay > 2 ** 31 - 1) continue; // already past (interval will still catch it), or too far out to schedule yet — a later scheduling pass picks it up

      scheduledChecks.add(key);
      setTimeout(() => {
        console.log(`[lateMailPoller] scheduled ${stage} check firing for ${game.id}`);
        pollLateMail().catch((err) => console.error("[lateMailPoller] scheduled check failed:", err));
      }, delay);
    }
  }
}

export function startLateMailPolling(): void {
  pollLateMail().catch((err) => console.error("[lateMailPoller] initial poll failed:", err));
  setInterval(() => {
    pollLateMail().catch((err) => console.error("[lateMailPoller] poll failed:", err));
  }, POLL_INTERVAL_MS);

  scheduleUpcomingChecks().catch((err) => console.error("[lateMailPoller] initial scheduling failed:", err));
  setInterval(() => {
    scheduleUpcomingChecks().catch((err) => console.error("[lateMailPoller] scheduling failed:", err));
  }, 60 * 60 * 1000); // re-arm hourly to pick up newly added fixtures

  console.log(
    `[lateMailPoller] auto-publishing INITIAL/24hr/FINAL team lists — every ${POLL_INTERVAL_MS / 60000}min plus a precise check ~${CHECK_BUFFER_MS / 60000}min after each game's expected 24hr/Final release (paused midnight-6am AEST/AEDT); anything needing real judgment (a starting-lineup change, a shape warning) is flagged for manual review instead of guessed at`
  );
}
