/**
 * "NRL News" is a Follow target, but unlike TEAM/PLAYER it has no
 * real row to point at — it's a single, fixed category. Both this file and
 * apps/web/src/lib/constants.ts must agree on the exact string, since the
 * frontend sends it as the `targetId` when a fan opts into league-wide
 * alerts, and notify.ts fans out to it by matching on targetType=LEAGUE
 * alone (targetId is mostly a formality here, kept for defense-in-depth).
 */
export const GENERAL_NEWS_TARGET_ID = "general-nrl-news";
