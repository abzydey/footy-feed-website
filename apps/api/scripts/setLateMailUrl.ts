// Pins this week's NRL.com team-list article as the Late Mail poller's
// source (see lateMailPoller.ts's pollLateMail priority order). Run when the
// user sends the Tuesday team-list link — NRL.com live-updates that same
// page through the week (Initial → 24hr → Final) and uses a fresh link each
// week, so one pin per week is all it needs. Stored in the DB, not memory,
// so a redeploy mid-week doesn't lose it.
//
//   npx tsx scripts/setLateMailUrl.ts <url>
//
// Validates before saving: the page must parse to a round heading and at
// least one match, so a wrong/typo'd link is rejected here instead of being
// silently pinned.
import { prisma } from "../src/lib/prisma";
import { fetchLateMail } from "../src/lib/lateMailParser";
import { analyzeLateMail } from "../src/lib/lateMailAnalysis";
import { PINNED_URL_KEY, pollLateMail } from "../src/lib/lateMailPoller";

async function main() {
  const url = process.argv[2];
  if (!url || !/^https:\/\/www\.nrl\.com\/news\//.test(url)) {
    console.error("Usage: npx tsx scripts/setLateMailUrl.ts https://www.nrl.com/news/...");
    process.exit(1);
  }

  const lateMail = await fetchLateMail(url);
  if (!lateMail.round || lateMail.matches.length === 0) {
    console.error(`Not pinned — couldn't find a round heading or any matches on ${url}`);
    process.exit(1);
  }
  const analyzed = await analyzeLateMail(lateMail);
  const unmatched = analyzed.flatMap((m) => [m.home, m.away]).filter((s) => !s.matchedGameId);

  await prisma.appSetting.upsert({
    where: { key: PINNED_URL_KEY },
    create: { key: PINNED_URL_KEY, value: url },
    update: { value: url },
  });

  console.log(`Pinned: ${url}`);
  console.log(`Round: ${lateMail.round}`);
  for (const m of analyzed) {
    console.log(`  ${m.matchLabel} → game ${m.home.matchedGameId ?? "NOT FOUND"} (${m.home.suggestedStage})`);
  }
  if (unmatched.length > 0) {
    console.log(`Warning: ${unmatched.map((s) => s.rawTeamName).join(", ")} didn't match a game — create the fixture first, or those teams won't update.`);
  }

  // Run one poll straight away so anything already published on the page
  // goes out now rather than at the next hourly cycle.
  await pollLateMail();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
