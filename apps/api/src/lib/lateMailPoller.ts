import { prisma } from "./prisma";
import { fetchLateMail, findLatestLateMailUrl } from "./lateMailParser";
import { analyzeLateMail, AnalyzedSide, Stage } from "./lateMailAnalysis";
import { notifyFollowersOfEvent } from "./notify";

// Automatic version of the chat/admin-panel-triggered Late Mail flow (see
// routes/adminLateMail.ts) — same fetch + analyze pipeline (lib/lateMailAnalysis.ts),
// just run on a timer and auto-publishing instead of waiting for a human to
// review and approve in chat first. Built after a run of manual Late Mail
// checks this session all came back clean, and the user asked to stop being
// asked every time.
//
// Deliberately only auto-publishes INITIAL and FINAL — both are the
// mechanical "N. Name" full-grid body lib/lateMailAnalysis.ts generates
// directly from the scrape, so there's nothing for a human to add. The
// TWENTY_FOUR_HOUR stage is different: its body is a hand-written prose
// sentence ("Liam Sutton remains the one reserve as the Cowboys trim their
// squad ahead of Saturday's clash with the Raiders" — see
// team_list_strikethrough_format conventions), not a mechanical diff, after
// an earlier mistake this session published the full grid there and had to
// be corrected ("The 24 hour update is only supposed to be words"). Nothing
// about the current scraper output can safely generate that prose on its
// own, so 24hr updates are left entirely to the existing manual/chat flow —
// this poller doesn't touch that stage at all.
const POLL_INTERVAL_MS = 20 * 60 * 1000;

// Dedup state so a shape-warning or unmatched-team problem that isn't going
// away doesn't get re-logged every single poll cycle — only worth a fresh
// log line when the underlying warning signature actually changes (or a
// previously-broken one clears).
const lastWarningSignature = new Map<string, string>();

function logIfChanged(key: string, signature: string, message: string): void {
  if (lastWarningSignature.get(key) === signature) return;
  lastWarningSignature.set(key, signature);
  console.log(message);
}

function buildHeadline(shortName: string, round: string, stage: Stage): string {
  return stage === "FINAL" ? `${shortName} Final Team List: ${round}` : `${shortName} ${round} team list`;
}

async function publishSide(side: AnalyzedSide, round: string, stage: "INITIAL" | "FINAL"): Promise<void> {
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

  const existing = await prisma.event.findFirst({
    where: { gameId: side.matchedGameId!, teamId: side.matchedTeamId!, type: "LINEUP_CHANGE", teamListStage: stage },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.body === side.generatedBody) return; // already up to date
    await prisma.event.update({ where: { id: existing.id }, data: { body: side.generatedBody } });
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
      body: side.generatedBody,
      createdBy: "late-mail-poller",
    },
  });
  console.log(`[lateMailPoller] published ${side.matchedTeamShortName} ${stage} team list`);
  notifyFollowersOfEvent(event.id).catch((err) => console.error(`[lateMailPoller] notifyFollowersOfEvent failed for ${event.id}:`, err));
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
    for (const side of [match.home, match.away]) {
      if (!side.matchedTeamId || !side.matchedGameId) {
        logIfChanged(
          `unmatched|${match.matchLabel}|${side.rawTeamName}`,
          "unmatched",
          `[lateMailPoller] couldn't match "${side.rawTeamName}" in "${match.matchLabel}" to a known team/game — skipping`
        );
        continue;
      }
      if (side.suggestedStage === "TWENTY_FOUR_HOUR") continue; // prose stage — left to the manual/chat flow, see file header
      await publishSide(side, lateMail.round, side.suggestedStage).catch((err) =>
        console.error(`[lateMailPoller] failed publishing ${side.matchedTeamShortName} (${side.suggestedStage}):`, err)
      );
    }
  }
}

export function startLateMailPolling(): void {
  pollLateMail().catch((err) => console.error("[lateMailPoller] initial poll failed:", err));
  setInterval(() => {
    pollLateMail().catch((err) => console.error("[lateMailPoller] poll failed:", err));
  }, POLL_INTERVAL_MS);
  console.log(`[lateMailPoller] auto-publishing clean INITIAL/FINAL team lists every ${POLL_INTERVAL_MS / 60000}min (paused midnight-6am AEST/AEDT); 24hr updates and anything with a shape warning are left for manual review`);
}
