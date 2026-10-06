import { WorldCupMatch } from "./api";

// Flag image per nation code used by the official draw (public/flags —
// images, not emoji, since Windows doesn't draw flag emoji).
const FLAG_FILES: Record<string, string> = {
  AUS: "au",
  NZL: "nz",
  FIJ: "fj",
  COO: "ck",
  SAM: "ws",
  FRA: "fr",
  PNG: "pg",
  LEB: "lb",
  ENG: "gb-eng",
  TNG: "to",
};
export const flagSrc = (abbr: string): string | null => (FLAG_FILES[abbr] ? `/flags/${FLAG_FILES[abbr]}.svg` : null);

// The tournament's on from a fortnight before the first game until a week
// after the Final — when Home and the menus give it pride of place.
export function worldCupActive(matches: WorldCupMatch[], now = Date.now()): boolean {
  if (matches.length === 0) return false;
  const first = new Date(matches[0].kickoffAt).getTime();
  const last = new Date(matches[matches.length - 1].kickoffAt).getTime();
  return now >= first - 14 * 86_400_000 && now <= last + 7 * 86_400_000;
}

// The game to lead with: the one being played, else the next one, else the
// most recent result.
export function featuredMatch(matches: WorldCupMatch[], now = Date.now()): WorldCupMatch | null {
  const live = matches.find((m) => m.status === "LIVE");
  if (live) return live;
  const next = matches.find((m) => m.status === "SCHEDULED" && new Date(m.kickoffAt).getTime() > now - 3 * 3_600_000);
  if (next) return next;
  return [...matches].reverse().find((m) => m.status === "FULL_TIME") ?? null;
}

export interface PoolRow {
  name: string;
  abbr: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  points: number;
}

// Pool table from finished pool games: 2 points a win, 1 a draw; ties on
// points split by points difference, then points scored. Every team in the
// pool is listed from the start (all zeros) so the table is there before
// a ball is kicked.
export function poolTable(matches: WorldCupMatch[], pool: "A" | "B"): PoolRow[] {
  const rows = new Map<string, PoolRow>();
  const row = (name: string, abbr: string) => {
    if (!rows.has(abbr)) {
      rows.set(abbr, { name, abbr, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, points: 0 });
    }
    return rows.get(abbr)!;
  };
  for (const m of matches.filter((x) => x.pool === pool)) {
    const h = row(m.homeName, m.homeAbbr);
    const a = row(m.awayName, m.awayAbbr);
    if (m.status !== "FULL_TIME" || m.homeScore == null || m.awayScore == null) continue;
    h.played++;
    a.played++;
    h.pointsFor += m.homeScore;
    h.pointsAgainst += m.awayScore;
    a.pointsFor += m.awayScore;
    a.pointsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.won++;
      a.lost++;
      h.points += 2;
    } else if (m.homeScore < m.awayScore) {
      a.won++;
      h.lost++;
      a.points += 2;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
    }
  }
  return [...rows.values()]
    .map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }))
    .sort((x, y) => y.points - x.points || y.diff - x.diff || y.pointsFor - x.pointsFor || x.name.localeCompare(y.name));
}

export function kickoffLabel(iso: string, withDay = true): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!withDay) return time;
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${time}`;
}

export interface WorldCupNation {
  name: string;
  abbr: string;
  pool: "A" | "B";
}

// The ten nations, from the pool games in the draw, alphabetical.
export function worldCupNations(matches: WorldCupMatch[]): WorldCupNation[] {
  const seen = new Map<string, WorldCupNation>();
  for (const m of matches) {
    if (!m.pool) continue;
    seen.set(m.homeAbbr, { name: m.homeName, abbr: m.homeAbbr, pool: m.pool });
    seen.set(m.awayAbbr, { name: m.awayName, abbr: m.awayAbbr, pool: m.pool });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// The draw marks the six B/C teams with one group: they're two pools of
// three that only play the OTHER pool, on one combined ladder (top 2 to the
// semi-finals, per rlwc2026.com). Shown as one "Pools B & C" everywhere.
export const poolLabel = (pool: "A" | "B" | null | undefined): string =>
  pool === "A" ? "Pool A" : pool === "B" ? "Pools B & C" : "";

export const POOL_NOTE: Record<"A" | "B", string> = {
  A: "Each team plays the other three. The top 2 go to the semi-finals.",
  B: "Pool B (England, Lebanon, Samoa) and Pool C (France, PNG, Tonga) share one ladder: each team plays the three teams in the other pool. The top 2 go to the semi-finals.",
};

// Which of the two B/C pools each of those six nations is in — the draw data
// only says "group 2" for all six; the lettering is from the official pools
// table (rlwc2026.com, Pool B + C), and matches the fixtures (each plays only
// the other pool).
export const SUB_POOL: Record<string, "B" | "C"> = {
  ENG: "B",
  LEB: "B",
  SAM: "B",
  FRA: "C",
  PNG: "C",
  TNG: "C",
};

// A nation's own pool: "Pool A", "Pool B" or "Pool C".
export const nationPoolLabel = (abbr: string, pool: "A" | "B" | null | undefined): string =>
  pool === "A" ? "Pool A" : SUB_POOL[abbr] ? `Pool ${SUB_POOL[abbr]}` : poolLabel(pool);

// Who the knockout games are between before the teams are known (official
// gameIds from the draw). Cross-over semis: Pool A 2nd v Pools B & C 1st on
// 7 Nov (Newcastle), Pool A 1st v Pools B & C 2nd on 8 Nov (Sydney).
const KNOCKOUT_SLOTS: Record<string, { home: string; away: string }> = {
  "20261310410": { home: "Pool A 2nd", away: "Pools B & C 1st" },
  "20261310420": { home: "Pool A 1st", away: "Pools B & C 2nd" },
  "20261310510": { home: "Semi-final 1 winner", away: "Semi-final 2 winner" },
};

// A side's display name: the nation, or its knockout slot while still TBA.
export function sideName(m: WorldCupMatch, side: "home" | "away"): string {
  const abbr = side === "home" ? m.homeAbbr : m.awayAbbr;
  if (abbr !== "TBA") return side === "home" ? m.homeName : m.awayName;
  return KNOCKOUT_SLOTS[m.id]?.[side] ?? "TBA";
}
