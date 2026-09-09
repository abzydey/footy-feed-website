// Inserts an Event directly, bypassing the admin web form — used when
// Claude parses a pasted news block from chat rather than someone filling in
// /admin by hand. Run with tsx (same as db:seed), not plain node — this
// imports lib/notify.ts, which pulls in the rest of the TS module graph.
// Takes a path to a JSON file (not inline args, to sidestep shell-quoting
// issues with punctuation in headlines/summaries):
//
//   { "headline": "...", "summary": "...", "source": "...", "author": "...", "link": "...", "team": "wests-tigers", "type": "TRANSFER" }
//
// source/author/link/team/type are optional. `team` is a Team.slug —
// GENERAL_NEWS is normally teamId-less (league-wide feed) but
// createEventSchema in routes/events.ts already allows tagging one anyway so
// the story also surfaces on that club's team page, per
// CONTRIBUTING-news.md's team-tagging rule. `type` defaults to GENERAL_NEWS;
// pass "TRANSFER" for a confirmed Signings item (requires `team`, per
// createEventSchema's refine — a TRANSFER can't be teamless). Per
// CONTRIBUTING-news.md, every Signings item also needs a matching
// GENERAL_NEWS copy — that's a second run of this script with the same
// input and type left at its default, not something this script does for
// you automatically, since a story spanning multiple teams needs one row
// per team per category (an Event only carries one team each). Fans out to
// followers the same way the admin route does (see routes/events.ts) — this
// is a second write path into the same Event table, not a separate
// mechanism.
import fs from "fs";

import { prisma } from "../src/lib/prisma";
import { notifyFollowersOfEvent } from "../src/lib/notify";

interface NewsInput {
  headline: string;
  summary: string;
  source?: string;
  author?: string;
  link?: string;
  team?: string;
  type?: "GENERAL_NEWS" | "TRANSFER";
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/addNews.ts <path-to-json>");
    process.exit(1);
  }

  const input: NewsInput = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  if (!input.headline || !input.summary) {
    console.error("JSON must include at least 'headline' and 'summary'.");
    process.exit(1);
  }

  const type = input.type ?? "GENERAL_NEWS";

  let teamId: string | undefined;
  if (input.team) {
    const team = await prisma.team.findUnique({ where: { slug: input.team } });
    if (!team) {
      console.error(`No team found with slug "${input.team}".`);
      process.exit(1);
    }
    teamId = team.id;
  }

  if (type === "TRANSFER" && !teamId) {
    console.error("TRANSFER events need a `team` — a Signings item can't be teamless.");
    process.exit(1);
  }

  const event = await prisma.event.create({
    data: {
      type,
      teamId,
      headline: input.headline,
      body: input.summary,
      sourceName: input.source || undefined,
      sourceAuthor: input.author || undefined,
      sourceUrl: input.link || undefined,
      createdBy: "claude-chat-import",
    },
  });

  console.log(`Created ${type} event ${event.id}: "${event.headline}"`);

  await notifyFollowersOfEvent(event.id);
  console.log("Followers notified.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
