import { Game, LadderRow } from "./api";

// The current NRL finals system (McIntyre final eight, in place since 2012)
// is a FIXED cross-pairing draw, not a dynamic reseed-by-ladder-position
// system — Week 2/3 pairings are set the moment the ladder locks in after
// Round 27, regardless of who actually wins each match. Hardcoded here
// rather than computed, per the final spec (verified against the real
// Finals Week 1 draw already in the Games table: Panthers(1) v Roosters(4),
// Warriors(2) v Dolphins(3), Sharks(5) v Cowboys(8), Rabbitohs(6) v
// Knights(7) — i.e. 1v4/2v3/5v8/6v7, not 1v2/3v4).
//
//   Week 1: QF1 = 1v4, QF2 = 2v3, EF1 = 5v8, EF2 = 6v7
//   Week 2: SF1 = Loser QF1 v Winner EF1, SF2 = Loser QF2 v Winner EF2
//           (QF1/QF2 winners bye straight to Week 3)
//   Week 3: PF1 = Winner QF1 v Winner SF2, PF2 = Winner QF2 v Winner SF1
//   Week 4: GF  = Winner PF1 v Winner PF2
//
// No-rematch invariant: a QF1 pair only fully reconverges at the GF at the
// earliest (winner routes via PF1, loser only reaches PF2 by winning SF1
// first) — same for QF2. Verified by hand against the fixed routing above
// before wiring this up; see the brief's own worked example.
export type TeamRef = LadderRow["team"];

export type SlotId = "QF1" | "QF2" | "EF1" | "EF2" | "SF1" | "SF2" | "PF1" | "PF2" | "GF";

export const ROUND_BY_SLOT: Record<SlotId, string> = {
  QF1: "Finals Week 1",
  QF2: "Finals Week 1",
  EF1: "Finals Week 1",
  EF2: "Finals Week 1",
  SF1: "Finals Week 2",
  SF2: "Finals Week 2",
  PF1: "Finals Week 3",
  PF2: "Finals Week 3",
  GF: "Grand Final",
};

// The four round names finals content can appear under — derived from
// ROUND_BY_SLOT (not hand-duplicated) so anything that needs "every finals
// round" (fetching games, deciding whether finals have started at all) stays
// in sync with the routing table above automatically.
export const FINALS_ROUNDS: string[] = Array.from(new Set(Object.values(ROUND_BY_SLOT)));

export const SLOT_LABEL: Record<SlotId, string> = {
  QF1: "Qualifying Final 1",
  QF2: "Qualifying Final 2",
  EF1: "Elimination Final 1",
  EF2: "Elimination Final 2",
  SF1: "Semi Final 1",
  SF2: "Semi Final 2",
  PF1: "Preliminary Final 1",
  PF2: "Preliminary Final 2",
  GF: "Grand Final",
};

export interface MatchSlot {
  id: SlotId;
  round: string;
  home: TeamRef | null;
  away: TeamRef | null;
  // The real Game row for this fixture, once entered by the admin — null
  // until it exists, even if home/away are both already known (bye winners
  // waiting on their Week 3 opponent, say).
  game: Game | null;
}

function findGame(games: Game[], round: string, a: TeamRef | null, b: TeamRef | null): Game | null {
  if (!a || !b) return null;
  return (
    games.find(
      (g) =>
        g.round === round &&
        ((g.homeTeam.id === a.id && g.awayTeam.id === b.id) || (g.homeTeam.id === b.id && g.awayTeam.id === a.id))
    ) ?? null
  );
}

// A game only has a settled winner once it's actually finished — LIVE
// carries scores too (see api.ts Game design note), so status must be
// checked, not just score presence.
export function winnerOf(slot: MatchSlot): TeamRef | null {
  const { game } = slot;
  if (!game || game.status !== "FULL_TIME" || game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore === game.awayScore) return null; // a drawn final would need a replay, not a winner
  return game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam;
}

export function loserOf(slot: MatchSlot): TeamRef | null {
  const winner = winnerOf(slot);
  if (!winner || !slot.home || !slot.away) return null;
  return winner.id === slot.home.id ? slot.away : slot.home;
}

export interface Bracket {
  slots: Record<SlotId, MatchSlot>;
  order: SlotId[];
}

// Pure function: real seeds (top 8 of the ladder, already rank-sorted) +
// whatever finals games exist so far -> the full bracket, slot by slot, in
// dependency order (each slot only reads slots computed before it).
export function buildFinalsBracket(top8: LadderRow[], games: Game[]): Bracket {
  const bySeed = (seed: number): TeamRef | null => top8.find((r) => r.rank === seed)?.team ?? null;

  const slot = (id: SlotId, home: TeamRef | null, away: TeamRef | null): MatchSlot => ({
    id,
    round: ROUND_BY_SLOT[id],
    home,
    away,
    game: findGame(games, ROUND_BY_SLOT[id], home, away),
  });

  const QF1 = slot("QF1", bySeed(1), bySeed(4));
  const QF2 = slot("QF2", bySeed(2), bySeed(3));
  const EF1 = slot("EF1", bySeed(5), bySeed(8));
  const EF2 = slot("EF2", bySeed(6), bySeed(7));

  const SF1 = slot("SF1", loserOf(QF1), winnerOf(EF1));
  const SF2 = slot("SF2", loserOf(QF2), winnerOf(EF2));

  const PF1 = slot("PF1", winnerOf(QF1), winnerOf(SF2));
  const PF2 = slot("PF2", winnerOf(QF2), winnerOf(SF1));

  const GF = slot("GF", winnerOf(PF1), winnerOf(PF2));

  return {
    slots: { QF1, QF2, EF1, EF2, SF1, SF2, PF1, PF2, GF },
    order: ["QF1", "QF2", "EF1", "EF2", "SF1", "SF2", "PF1", "PF2", "GF"],
  };
}

// --- Predictor -------------------------------------------------------------
// A second, parallel routing over the same fixed seed structure — same shape
// as buildFinalsBracket above, but the "winner" of each slot comes from a
// user's own pick (localStorage, see FinalsPredictor.tsx) instead of a real
// Game result. Kept as its own small function rather than a shared generic
// parameterized over "how do you resolve a winner" — the two resolvers are
// different enough (one reads Games, one reads a plain pick map) that a
// shared abstraction would mostly be indirection, not saved logic.

export interface PredictedSlot {
  id: SlotId;
  home: TeamRef | null;
  away: TeamRef | null;
  winner: TeamRef | null;
}

export function buildPredictedBracket(
  top8: LadderRow[],
  picks: Partial<Record<SlotId, string>>
): Record<SlotId, PredictedSlot> {
  const bySeed = (seed: number): TeamRef | null => top8.find((r) => r.rank === seed)?.team ?? null;

  function resolve(id: SlotId, home: TeamRef | null, away: TeamRef | null): PredictedSlot {
    const pickedId = picks[id];
    const winner = !pickedId ? null : home?.id === pickedId ? home : away?.id === pickedId ? away : null;
    return { id, home, away, winner };
  }
  function loserOf(s: PredictedSlot): TeamRef | null {
    if (!s.winner) return null;
    return s.winner.id === s.home?.id ? s.away : s.home;
  }

  const QF1 = resolve("QF1", bySeed(1), bySeed(4));
  const QF2 = resolve("QF2", bySeed(2), bySeed(3));
  const EF1 = resolve("EF1", bySeed(5), bySeed(8));
  const EF2 = resolve("EF2", bySeed(6), bySeed(7));

  const SF1 = resolve("SF1", loserOf(QF1), EF1.winner);
  const SF2 = resolve("SF2", loserOf(QF2), EF2.winner);

  const PF1 = resolve("PF1", QF1.winner, SF2.winner);
  const PF2 = resolve("PF2", QF2.winner, SF1.winner);

  const GF = resolve("GF", PF1.winner, PF2.winner);

  return { QF1, QF2, EF1, EF2, SF1, SF2, PF1, PF2, GF };
}

// Teams still alive: everyone in the top 8 minus whoever has already lost a
// final. A team with no finals game played yet is still alive by default.
export function teamsAliveInFinals(top8: LadderRow[], games: Game[]): TeamRef[] {
  const bracket = buildFinalsBracket(top8, games);
  const eliminated = new Set<string>();
  for (const id of bracket.order) {
    const loser = loserOf(bracket.slots[id]);
    if (loser) eliminated.add(loser.id);
  }
  return top8.map((r) => r.team).filter((t) => !eliminated.has(t.id));
}
