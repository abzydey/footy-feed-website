// Adds or updates players on the free agency list (FreeAgent table, see
// schema.prisma). Takes a path to a JSON file holding one player or an
// array of them:
//
//   [{ "player": "Harry Grant", "team": "storm", "position": "Hooker",
//      "tier": "MARQUEE", "linked": ["titans"], "freeAgentNow": false,
//      "aliases": ["Harrison Grant"], "note": "..." }]
//
// Only the fields given are changed, so an update can be just
// { "player": "Sam Walker", "linked": ["perth-bears", "cowboys"] }.
// "tier": null drops a player out of the top list; "remove": true deletes
// him from the list. team/linked are Team slugs. season defaults to 2028.
// Crossing a player off is NOT done here: record the deal with
// addTransfer.ts and the list picks it up.
import fs from "fs";

import { FreeAgentTier } from "@prisma/client";

import { FREE_AGENCY_SEASON } from "../src/routes/freeAgents";
import { prisma } from "../src/lib/prisma";

interface Input {
  player: string;
  season?: number;
  team?: string;
  position?: string | null;
  tier?: FreeAgentTier | null;
  linked?: string[];
  freeAgentNow?: boolean;
  aliases?: string[];
  note?: string | null;
  remove?: boolean;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/setFreeAgents.ts <file.json>");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const list: Input[] = Array.isArray(raw) ? raw : [raw];

  const teams = new Map((await prisma.team.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
  const slugOk = (s: string) => {
    if (!teams.has(s)) throw new Error(`Unknown team slug: ${s}`);
    return s;
  };

  for (const p of list) {
    const season = p.season ?? FREE_AGENCY_SEASON;
    const where = { season_player: { season, player: p.player } };
    if (p.remove) {
      await prisma.freeAgent.deleteMany({ where: { season, player: p.player } });
      console.log(`Removed: ${p.player}`);
      continue;
    }
    if (p.tier != null && !Object.values(FreeAgentTier).includes(p.tier)) throw new Error(`Bad tier for ${p.player}: ${p.tier}`);
    const data = {
      ...(p.team !== undefined && { teamId: teams.get(slugOk(p.team)) }),
      ...(p.position !== undefined && { position: p.position }),
      ...(p.tier !== undefined && { tier: p.tier }),
      ...(p.linked !== undefined && { linked: p.linked.map(slugOk) }),
      ...(p.freeAgentNow !== undefined && { freeAgentNow: p.freeAgentNow }),
      ...(p.aliases !== undefined && { aliases: p.aliases }),
      ...(p.note !== undefined && { note: p.note }),
    };
    const existing = await prisma.freeAgent.findUnique({ where });
    if (existing) await prisma.freeAgent.update({ where, data });
    else await prisma.freeAgent.create({ data: { season, player: p.player, ...data } });
    console.log(`${existing ? "Updated" : "Added"}: ${p.player}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
