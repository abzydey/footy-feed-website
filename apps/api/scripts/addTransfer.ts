// Adds confirmed player moves to the signings tracker (Transfer table, see
// schema.prisma). Run alongside addNews.ts for every confirmed Signing — the
// news story says it in words, this records it as data. Takes a path to a
// JSON file holding one move or an array of them:
//
//   [{ "player": "Joe Chan", "kind": "SIGNED", "from": "storm", "to": "cowboys",
//      "until": 2028, "headline": "Cowboys sign Storm backrower Joe Chan on two-year deal" }]
//
// kind: SIGNED | RE_SIGNED | RELEASED | RETIRED. from/to are Team slugs;
// fromLabel/toLabel cover anywhere that isn't an NRL club ("St Helens",
// "Rugby union"). until is the last season of the deal, only if the story
// says it. headline links the move to its Signings story (the newest
// TRANSFER event with that exact headline) and takes that story's time as
// the announcement time; announcedAt (ISO) overrides it. A move already
// recorded (same player, kind and clubs) is skipped, so re-running is safe.
import fs from "fs";

import { TransferKind } from "@prisma/client";

import { prisma } from "../src/lib/prisma";

interface MoveInput {
  player: string;
  kind: TransferKind;
  from?: string;
  to?: string;
  fromLabel?: string;
  toLabel?: string;
  until?: number;
  headline?: string;
  announcedAt?: string;
}

async function teamId(slug: string | undefined): Promise<string | null> {
  if (!slug) return null;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) throw new Error(`Unknown team slug "${slug}"`);
  return team.id;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/addTransfer.ts <moves.json>");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const moves: MoveInput[] = Array.isArray(raw) ? raw : [raw];

  for (const m of moves) {
    if (!m.player || !Object.values(TransferKind).includes(m.kind)) {
      throw new Error(`Bad move: ${JSON.stringify(m)}`);
    }
    if (m.kind === "SIGNED" && !m.to) throw new Error(`SIGNED needs "to": ${m.player}`);
    if (m.kind === "RE_SIGNED" && !m.to) throw new Error(`RE_SIGNED needs "to" (the club they stayed at): ${m.player}`);
    if ((m.kind === "RELEASED" || m.kind === "RETIRED") && !m.from) throw new Error(`${m.kind} needs "from": ${m.player}`);

    const fromTeamId = await teamId(m.from);
    const toTeamId = await teamId(m.to);

    const event = m.headline
      ? await prisma.event.findFirst({
          where: { type: "TRANSFER", headline: m.headline },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        })
      : null;
    if (m.headline && !event) throw new Error(`No Signings story with headline "${m.headline}"`);

    const existing = await prisma.transfer.findFirst({
      where: { player: m.player, kind: m.kind, fromTeamId, toTeamId },
    });
    if (existing) {
      console.log(`Skipped (already recorded): ${m.player} ${m.kind}`);
      continue;
    }

    await prisma.transfer.create({
      data: {
        player: m.player,
        kind: m.kind,
        fromTeamId,
        toTeamId,
        fromLabel: m.fromLabel ?? null,
        toLabel: m.toLabel ?? null,
        contractUntil: m.until ?? null,
        eventId: event?.id ?? null,
        announcedAt: m.announcedAt ? new Date(m.announcedAt) : (event?.createdAt ?? new Date()),
      },
    });
    console.log(
      `Added: ${m.player} — ${m.kind}${m.from ? ` from ${m.from}` : m.fromLabel ? ` from ${m.fromLabel}` : ""}${
        m.to ? ` to ${m.to}` : m.toLabel ? ` to ${m.toLabel}` : ""
      }${m.until ? ` until ${m.until}` : ""}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
