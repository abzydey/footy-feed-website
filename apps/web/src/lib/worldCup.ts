import { WorldCupMatch } from "./api";

// Flag per nation code used by the official draw. Shown beside the name,
// never instead of it (some desktop browsers draw flags as two letters).
const FLAGS: Record<string, string> = {
  AUS: "🇦🇺",
  NZL: "🇳🇿",
  FIJ: "🇫🇯",
  COO: "🇨🇰",
  SAM: "🇼🇸",
  FRA: "🇫🇷",
  PNG: "🇵🇬",
  LEB: "🇱🇧",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  TNG: "🇹🇴",
};
export const flagFor = (abbr: string) => FLAGS[abbr] ?? "";

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
