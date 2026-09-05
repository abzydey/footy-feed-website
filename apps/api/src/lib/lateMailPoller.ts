import { prisma } from "./prisma";
import { fetchLateMail, findLatestLateMailUrl } from "./lateMailParser";
import { analyzeLateMail, generateTwentyFourHourBody, AnalyzedSide, Stage } from "./lateMailAnalysis";
import { notifyFollowersOfEvent } from "./notify";

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
const POLL_INTERVAL_MS = 20 * 60 * 1000;

// The two checkpoints have a real, computable kickoff-relative expectation
// (same offsets TeamListCard.tsx's PLACEHOLDER_OFFSET_MS assumes: ~24h and
// ~90min before kickoff) — INITIAL doesn't, it's a league-wide Tuesday
// release with no per-game anchor, so it just rides the generic interval
// below. Checking exactly at the expected moment risks polling a beat
// before NRL.com has actually published — CHECK_BUFFER_MS waits 2 minutes
// past it instead, so a 7:35pm kickoff's Final check fires at 6:07pm
// (90min - 2min = 88min before kickoff), not 6:05pm.
const TWENTY_FOUR_HOUR_OFFSET_MS = 24 * 60 * 60 * 1000;
const FINAL_OFFSET_MS = 90 * 60 * 1000;
const CHECK_BUFFER_MS = 2 * 60 * 1000;

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

export async function pollLateMail(): Promise<void> {
  if (isQuietHours()) return;

  const url = await findLatestLateMailUrl().catch((err) => {
    console.warn("[lateMailPoller] failed to find current Late Mail article:", err);
    return null;
  });
  if (!url) return;

  let lateMail;
  try {
    lateMail = await fetchLateMail(url);
  } catch (err) {
    console.warn(`[lateMailPoller] failed to fetch/parse ${url}:`, err);
    return;
  }
  if (!lateMail.round) return; // can't tell which round this is — nothing safe to key events to

  const matches = await analyzeLateMail(lateMail);

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
    `[lateMailPoller] auto-publishing INITIAL/24hr/FINAL team lists — every ${POLL_INTERVAL_MS / 60000}min plus a precise check ~2min after each game's expected 24hr/Final release (paused midnight-6am AEST/AEDT); anything needing real judgment (a starting-lineup change, a shape warning) is flagged for manual review instead of guessed at`
  );
}
