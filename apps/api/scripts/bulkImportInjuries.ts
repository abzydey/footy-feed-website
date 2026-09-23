// Bulk-updates Player.currentStatus from a batch of injury entries (e.g. a
// full "Casualty Ward" screenshot covering many players/teams at once) —
// the counterpart to addNews.ts's single-article INJURY Event flow.
//
// Deliberately does NOT import lib/notify.ts or touch the Event table at
// all — that's the whole point of this script existing as its own file
// rather than a loop calling the same code path as a single deliberate
// injury update. A bulk import runs against data that's often already a
// few days old by the time it's transcribed, and Event.createdAt has no
// backdating option (see routes/events.ts) — it always stamps "now". An
// Event made from backdated bulk data would show up in the News/Feed page
// and push a notification with today's date on week-old news, which is
// exactly the bug this script exists to make structurally impossible: with
// no Event import in this file, there's no code path left that could
// accidentally wire one up here, even by a future edit.
//
// A single real article about one player breaking overnight is still an
// Event, entered the normal way (admin form or scripts/addNews.ts-style
// chat import) — that's timely enough that "posted today" is simply true.
//
// Run with tsx (same as addNews.ts), not plain node. Takes a path to a
// JSON file:
//
//   [
//     { "team": "warriors", "player": "Adam Pompey", "status": "OUT", "note": "Released, joining Storm" },
//     { "team": "knights", "player": "Dylan Lucas", "status": "AVAILABLE" }
//   ]
//
// `team` is a Team.slug, `player` is matched case-insensitively against
// that team's roster (exact name match — not fuzzy, so a typo reports as
// "not found" rather than silently landing on the wrong player), `status`
// is one of Prisma's AvailabilityStatus values, `note` is optional free
// text (cleared to null if omitted). Not wrapped in a transaction — same
// reasoning as adminPlayers.ts's bulk-create route: one bad row (unknown
// team, no matching player, typo'd status) shouldn't sink every valid row
// in the same batch, so this applies what it can and reports the rest.
import fs from "fs";

import { prisma } from "../src/lib/prisma";
import { AvailabilityStatus } from "@prisma/client";

interface InjuryInput {
  team: string;
  player: string;
  status: string;
  note?: string;
}

const VALID_STATUSES = new Set<string>(["UNKNOWN", "AVAILABLE", "QUESTIONABLE", "OUT", "INJURED", "SUSPENDED"]);

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/bulkImportInjuries.ts <path-to-json>");
    process.exit(1);
  }

  const entries: InjuryInput[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("JSON must be a non-empty array of { team, player, status, note? } entries.");
    process.exit(1);
  }

  let updated = 0;
  const skipped: string[] = [];

  for (const entry of entries) {
    const label = `${entry.player ?? "?"} (${entry.team ?? "?"})`;

    if (!entry.team || !entry.player || !entry.status) {
      skipped.push(`${label}: missing team, player, or status`);
      continue;
    }
    if (!VALID_STATUSES.has(entry.status)) {
      skipped.push(`${label}: unrecognised status "${entry.status}"`);
      continue;
    }

    const team = await prisma.team.findUnique({ where: { slug: entry.team } });
    if (!team) {
      skipped.push(`${label}: no team found with slug "${entry.team}"`);
      continue;
    }

    const matches = await prisma.player.findMany({
      where: { teamId: team.id, name: { equals: entry.player, mode: "insensitive" } },
    });
    if (matches.length === 0) {
      skipped.push(`${label}: no player named "${entry.player}" on ${team.shortName}'s roster`);
      continue;
    }
    if (matches.length > 1) {
      skipped.push(`${label}: ${matches.length} players named "${entry.player}" on ${team.shortName} — ambiguous, skipped`);
      continue;
    }

    await prisma.player.update({
      where: { id: matches[0].id },
      data: {
        currentStatus: entry.status as AvailabilityStatus,
        currentStatusNote: entry.note ?? null,
        statusUpdatedAt: new Date(),
      },
    });
    updated++;
    console.log(`Updated ${label}: ${entry.status}${entry.note ? ` — ${entry.note}` : ""}`);
  }

  console.log(`\n${updated} player(s) updated, ${skipped.length} skipped.`);
  if (skipped.length > 0) {
    console.log("Skipped:");
    skipped.forEach((s) => console.log(`  - ${s}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
