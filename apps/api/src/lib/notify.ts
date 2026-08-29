import { prisma } from "./prisma";
import { GENERAL_NEWS_TARGET_ID } from "./constants";
import { getFirebaseMessaging } from "./firebase";

/**
 * Fan-out a newly created Event to every Subscriber following its team,
 * player, or (for GENERAL_NEWS) the league-wide news category, and send a
 * real web push via Firebase Cloud Messaging.
 *
 * Falls back to a console.log stub when FIREBASE_SERVICE_ACCOUNT_JSON isn't
 * set (see README "Alerts" section) — so a fresh clone without a Firebase
 * project still runs without crashing.
 */
export async function notifyFollowersOfEvent(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: true, player: { include: { team: true } }, game: true },
  });
  if (!event) return;

  // GENERAL_NEWS has no team/player — it fans out to LEAGUE followers only.
  // Everything else fans out to whoever follows the relevant team/player.
  let targetIds = [event.teamId, event.playerId, event.player?.teamId].filter(
    (id): id is string => Boolean(id)
  );
  // An event tied only to a game (no specific team/player picked) still
  // reaches fans of either side playing — e.g. a match-wide "team lists are
  // in" note that isn't attached to one team in particular.
  if (targetIds.length === 0 && event.game) {
    targetIds = [event.game.homeTeamId, event.game.awayTeamId];
  }
  const fanOutWhere =
    event.type === "GENERAL_NEWS"
      ? { targetType: "LEAGUE" as const, targetId: GENERAL_NEWS_TARGET_ID }
      : {
          OR: [
            { targetType: "TEAM" as const, targetId: { in: targetIds } },
            { targetType: "PLAYER" as const, targetId: event.playerId ?? "__none__" },
          ],
        };
  if (event.type !== "GENERAL_NEWS" && targetIds.length === 0) return;

  const follows = await prisma.follow.findMany({ where: fanOutWhere, include: { subscriber: true } });
  if (follows.length === 0) return;

  // De-dupe: a fan could follow both the player and their team.
  const uniqueSubscribers = new Map<string, any>(
    follows.map((follow: any) => [follow.subscriberId, follow.subscriber])
  );

  // A FINAL-stage team list is the last-minute-change moment fantasy/punting
  // users care about most — flag it clearly in the notification itself
  // rather than relying on the admin to word the headline urgently.
  const notificationTitle =
    event.type === "LINEUP_CHANGE" && event.teamListStage === "FINAL"
      ? `🚨 LATE CHANGE: ${event.headline}`
      : event.headline;

  const subscribers = [...uniqueSubscribers.values()];
  const messaging = getFirebaseMessaging();

  if (!messaging) {
    // Not configured — log what would be sent, same as before, so local dev
    // without a Firebase project still works.
    for (const subscriber of subscribers) {
      console.log(
        `[notify] would push to subscriber ${subscriber.id} (token ${subscriber.fcmToken.slice(0, 8)}…): ` +
          `"${notificationTitle}"`
      );
      await prisma.notificationLog.upsert({
        where: { eventId_subscriberId: { eventId: event.id, subscriberId: subscriber.id } },
        create: { eventId: event.id, subscriberId: subscriber.id, status: "SENT" },
        update: {},
      });
    }
    return;
  }

  // Real send: one message per subscriber token, batched in a single call.
  // sendEachForMulticast returns responses in the same order as the tokens
  // array, so index them back to subscribers to log success/failure per fan.
  const response = await messaging.sendEachForMulticast({
    tokens: subscribers.map((s) => s.fcmToken),
    notification: { title: notificationTitle, body: event.body },
  });

  await Promise.all(
    response.responses.map((result, i) => {
      const subscriber = subscribers[i];
      if (result.success) {
        console.log(`[notify] sent to subscriber ${subscriber.id} (token ${subscriber.fcmToken.slice(0, 8)}…)`);
      } else {
        console.error(
          `[notify] failed for subscriber ${subscriber.id} (token ${subscriber.fcmToken.slice(0, 8)}…):`,
          result.error?.message
        );
      }
      return prisma.notificationLog.upsert({
        where: { eventId_subscriberId: { eventId: event.id, subscriberId: subscriber.id } },
        create: {
          eventId: event.id,
          subscriberId: subscriber.id,
          status: result.success ? "SENT" : "FAILED",
          error: result.success ? undefined : result.error?.message,
        },
        update: {},
      });
    })
  );
}
