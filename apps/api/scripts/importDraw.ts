// Loads a season's NRL draw from NRL.com into Games, every round at once.
// Safe to re-run whenever the NRL moves a game: a fixture already stored
// (same season, round and clubs) gets its kickoff and venue updated, and
// nothing is created twice. Games already started or finished are left alone.
//
//   npx tsx scripts/importDraw.ts 2027
//   npx tsx scripts/importDraw.ts 2027 --dry-run     show what would change
//
// Finals aren't in the draw until the teams are known — only numbered rounds.
// Uses curl because Node's fetch ignores the cloud sessions' proxy.
import { execFileSync } from "child_process";

import { prisma } from "../src/lib/prisma";

interface DrawFixture {
  type: string;
  roundTitle: string;
  venue?: string;
  homeTeam: { theme: { key: string } };
  awayTeam: { theme: { key: string } };
  clock: { kickOffTimeLong: string };
}

function fetchRound(season: number, round: number): { fixtures: DrawFixture[]; filterRounds: { value: number }[] } {
  const url = `https://www.nrl.com/draw/data?competition=111&season=${season}&round=${round}`;
  const body = execFileSync("curl", ["-sS", "--fail", "--max-time", "60", "-A", "Mozilla/5.0", url], { maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(body.toString());
}

async function main() {
  const season = Number(process.argv[2]);
  const dryRun = process.argv.includes("--dry-run");
  if (!Number.isInteger(season) || season < 2020) {
    console.error("Usage: npx tsx scripts/importDraw.ts <season> [--dry-run]");
    process.exit(1);
  }

  // NRL.com's team keys are our Team slugs (perth-bears included).
  const teams = await prisma.team.findMany();
  const teamBySlug = new Map(teams.map((t) => [t.slug, t]));
  const seasonRange = { gte: new Date(Date.UTC(season, 0, 1)), lt: new Date(Date.UTC(season + 1, 0, 1)) };
  const existing = await prisma.game.findMany({ where: { kickoffAt: seasonRange } });

  const roundCount = Math.max(...fetchRound(season, 1).filterRounds.map((r) => r.value));
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const problems: string[] = [];

  for (let r = 1; r <= roundCount; r++) {
    for (const f of fetchRound(season, r).fixtures) {
      if (f.type !== "Match") continue;
      const home = teamBySlug.get(f.homeTeam.theme.key);
      const away = teamBySlug.get(f.awayTeam.theme.key);
      if (!home || !away) {
        problems.push(`${f.roundTitle}: unknown team ${f.homeTeam.theme.key} v ${f.awayTeam.theme.key}`);
        continue;
      }
      const kickoffAt = new Date(f.clock.kickOffTimeLong);
      const venue = f.venue || null;
      const label = `${f.roundTitle}: ${home.shortName} v ${away.shortName}`;

      const game = existing.find((g) => g.round === f.roundTitle && g.homeTeamId === home.id && g.awayTeamId === away.id);
      if (!game) {
        if (!dryRun) await prisma.game.create({ data: { homeTeamId: home.id, awayTeamId: away.id, round: f.roundTitle, kickoffAt, venue } });
        created++;
        continue;
      }
      if (game.status !== "SCHEDULED" || (game.kickoffAt.getTime() === kickoffAt.getTime() && game.venue === venue)) {
        unchanged++;
        continue;
      }
      console.log(`Moved ${label}: ${game.kickoffAt.toISOString()} ${game.venue ?? ""} -> ${kickoffAt.toISOString()} ${venue ?? ""}`);
      if (!dryRun) await prisma.game.update({ where: { id: game.id }, data: { kickoffAt, venue } });
      updated++;
    }
  }

  console.log(`${dryRun ? "[dry run] " : ""}${season} draw, ${roundCount} rounds: ${created} added, ${updated} updated, ${unchanged} unchanged`);
  for (const p of problems) console.log(`Skipped — ${p}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
