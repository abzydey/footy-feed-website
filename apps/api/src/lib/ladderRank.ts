// Standard NRL ladder ordering: competition points first, then points
// differential, then points for, as tiebreakers. Shared between the public
// GET (routes/ladder.ts) and the admin PUT (routes/adminLadder.ts, which
// needs it to snapshot each team's rank right before an update overwrites
// it — see LadderEntry.previousRank).
export function sortByLadderRank<T extends { competitionPoints: number; pointsFor: number; pointsAgainst: number }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    if (b.competitionPoints !== a.competitionPoints) return b.competitionPoints - a.competitionPoints;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.pointsFor - a.pointsFor;
  });
}
