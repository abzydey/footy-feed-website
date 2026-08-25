import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { GENERAL_NEWS_TARGET_ID } from "./constants";

/**
 * Fan-out a newly created Event to every Subscriber following its team,
 * player, or (for GENERAL_NEWS) the league-wide news category, and send a
 * web push via Firebase Cloud Messaging.
 *
 * STUBBED for the initial scaffold: this resolves the "who should be
 * notified" query (the part that depends on our schema) and logs what it
 * would send, but does not call the Firebase Admin SDK yet. Wiring in
 * `firebase-admin` and swapping the console.log for `messaging.sendEach(...)`
 * is the Phase 1 "Alerts" task — see README.
 */
export async function notifyFollowersOfEvent(eventId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { team: true, player: { include: { team: true } } },
  });
  if (!event) return;

  // GENERAL_NEWS has no team/player — it fans out to LEAGUE followers only.
  // Everything else fans out to whoever follows the relevant team/player.
  const targetIds = [event.teamId, event.playerId, event.player?.teamId].filter(
    (id): id is string => Boolean(id)
  );
  const fanOutWhere: Prisma.FollowWhereInput =
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
  const uniqueSubscribers = new Map(
    follows.map((follow: (typeof follows)[number]) => [follow.subscriberId, follow.subscriber])
  );

  for (const subscriber of uniqueSubscribers.values()) {
    // TODO(alerts): replace with firebase-admin messaging.send({ token, notification: {...} })
    console.log(
      `[notify] would push to subscriber ${subscriber.id} (token ${subscriber.fcmToken.slice(0, 8)}…): ` +
        `"${event.headline}"`
    );

    await prisma.notificationLog.upsert({
      where: { eventId_subscriberId: { eventId: event.id, subscriberId: subscriber.id } },
      create: { eventId: event.id, subscriberId: subscriber.id, status: "SENT" },
      update: {},
    });
  }
}
