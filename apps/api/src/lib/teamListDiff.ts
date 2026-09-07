// Decides whether a newly-entered LINEUP_CHANGE stage actually changed the
// roster from the immediately preceding stage for the same game+team, so
// routes/events.ts can skip notifyFollowersOfEvent() for a no-op stage post
// (e.g. "24hr team unchanged from initial"). Mirrors the parsing regexes in
// apps/web/src/components/TeamListCard.tsx (NUMBERED_PLAYER, OMITTED_NAMES,
// computeChangedNames) — there's no shared package in this monorepo
// (workspaces: ["apps/*"] only), so this is a deliberate duplicate. Keep it
// in sync with that file if the admin-entry format changes.

interface NumberedPlayer {
  number: number;
  name: string;
}

interface ParsedTeamList {
  starters: NumberedPlayer[];
  bench: NumberedPlayer[];
  reserves: NumberedPlayer[];
}

const NUMBERED_PLAYER = /(\d{1,2})\.\s*([^,.]+?)(?=,|\.|$)/g;

function extractPlayers(segment: string): NumberedPlayer[] {
  return [...segment.matchAll(NUMBERED_PLAYER)].map((m) => ({ number: Number(m[1]), name: m[2].trim() }));
}

function parseTeamList(body: string): ParsedTeamList | null {
  const totalMatches = [...body.matchAll(NUMBERED_PLAYER)];
  if (totalMatches.length < 10) return null;

  const benchIdx = body.indexOf("Bench:");
  const reservesIdx = body.indexOf("Reserves:");

  if (benchIdx === -1) {
    const players = totalMatches.map((m) => ({ number: Number(m[1]), name: m[2].trim() }));
    return {
      starters: players.filter((p) => p.number <= 13),
      bench: players.filter((p) => p.number >= 14 && p.number <= 19),
      reserves: players.filter((p) => p.number >= 20),
    };
  }

  return {
    starters: extractPlayers(body.slice(0, benchIdx)),
    bench: extractPlayers(reservesIdx === -1 ? body.slice(benchIdx) : body.slice(benchIdx, reservesIdx)),
    reserves: reservesIdx === -1 ? [] : extractPlayers(body.slice(reservesIdx)),
  };
}

const OMITTED_NAMES = /Omitted from the \d+ — ([^.]+)\./;

function parseOmittedNames(body: string): string[] {
  const match = body.match(OMITTED_NAMES);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// Slot-aware for starters (a position swap matters even with the same 22
// names), set-based for bench (interchange order carries no positional
// meaning) — same reasoning as TeamListCard.tsx's computeChangedNames.
function rostersDiffer(prior: ParsedTeamList, next: ParsedTeamList): boolean {
  for (let i = 0; i < Math.max(prior.starters.length, next.starters.length); i++) {
    if (prior.starters[i]?.name.toLowerCase() !== next.starters[i]?.name.toLowerCase()) return true;
  }
  const priorBench = new Set(prior.bench.map((p) => p.name.toLowerCase()));
  const nextBench = new Set(next.bench.map((p) => p.name.toLowerCase()));
  if (priorBench.size !== nextBench.size) return true;
  for (const name of nextBench) if (!priorBench.has(name)) return true;
  return false;
}

/**
 * True if `newBody` (the stage being saved) represents a real roster change
 * from `priorBody` (the immediately preceding stage for the same game+team,
 * or undefined if this is the first team-list post for that game+team —
 * always "changed" in that case, there's nothing to compare against).
 *
 * Defaults to "changed" whenever the two bodies can't be confidently
 * compared (e.g. one is delta-style text without a full numbered list) —
 * suppressing a real change is worse than one extra notification.
 */
export function hasRosterChanged(newBody: string, priorBody: string | undefined): boolean {
  if (!priorBody) return true;

  const omitted = parseOmittedNames(newBody);
  if (omitted.length > 0) return true;

  const newRoster = parseTeamList(newBody);
  const priorRoster = parseTeamList(priorBody);
  if (newRoster && priorRoster) return rostersDiffer(priorRoster, newRoster);

  // newBody has neither an "Omitted from…" clause nor a full numbered list —
  // no player-change signal at all, e.g. "No changes to the 24hr team list."
  if (!newRoster) return false;

  // newBody is a full re-list (FINAL's "full grid preferred" convention) but
  // priorBody wasn't (24hr's delta-only convention) — can't diff directly.
  return true;
}
