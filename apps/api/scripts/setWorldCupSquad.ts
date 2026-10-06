// Enters (or replaces) a nation's men's World Cup squad, from the official
// announcement. Run with tsx from apps/api:
//
//   npx tsx scripts/setWorldCupSquad.ts squad.json
//
// squad.json:
//   { "abbr": "AUS", "players": [{ "name": "Isaah Yeo", "captain": true },
//     { "name": "Bradman Best", "debutant": true }, …], "shadows": ["Thomas Jenkins"],
//     "note": "Lindsay Smith replaces the injured Lindsay Collins." }
//
// abbr is the official draw's nation code (AUS NZL FIJ COO SAM FRA PNG LEB
// ENG TNG); the nation's name comes from the draw. Players stay in the
// order given. Only mark captain/debutant when the announcement says so.
import fs from "fs";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/lib/prisma";

interface SquadInput {
  abbr: string;
  // club: the player's club when the announcement lists it.
  players: { name: string; club?: string; captain?: boolean; debutant?: boolean }[];
  shadows?: string[];
  // Shown with the squad: "One to be omitted", an injury replacement…
  note?: string;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/setWorldCupSquad.ts <squad.json>");
  const input: SquadInput = JSON.parse(fs.readFileSync(file, "utf8"));
  const abbr = input.abbr?.toUpperCase();

  const match = await prisma.worldCupMatch.findFirst({
    where: { OR: [{ homeAbbr: abbr }, { awayAbbr: abbr }] },
    select: { homeAbbr: true, homeName: true, awayName: true },
  });
  if (!match) throw new Error(`No World Cup nation with code "${abbr}" in the draw`);
  const name = match.homeAbbr === abbr ? match.homeName : match.awayName;

  if (!Array.isArray(input.players) || input.players.length === 0) throw new Error("players is empty");
  const players = input.players.map((p) => ({
    name: p.name.trim(),
    ...(p.club?.trim() ? { club: p.club.trim() } : {}),
    ...(p.captain ? { captain: true } : {}),
    ...(p.debutant ? { debutant: true } : {}),
  }));
  const shadows = input.shadows?.map((s) => s.trim()) ?? null;

  await prisma.worldCupSquad.upsert({
    where: { abbr },
    create: { abbr, name, players, shadows: shadows ?? Prisma.DbNull, note: input.note?.trim() || null },
    update: { name, players, shadows: shadows ?? Prisma.DbNull, note: input.note?.trim() || null },
  });
  console.log(`${name} squad saved: ${players.length} players${shadows ? `, ${shadows.length} shadow` : ""}`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
