import * as cheerio from "cheerio";

// Scrapes NRL.com's weekly "Late Mail" article — the same URL is live-
// updated by NRL.com throughout the week (Tuesday's initial squads, then
// 24hr and Final changes get folded into the same page), so this is
// designed to be re-run against the same URL at different points in the
// week, not a one-shot fetch. Never auto-publishes — see
// routes/adminLateMail.ts, which only ever returns parsed data for the
// admin to review and explicitly confirm via the existing event-creation
// flow.
//
// A plain fetch with a real browser User-Agent gets the actual article
// (confirmed 2026-09-04) — WebFetch's own request was what triggered
// NRL.com's login-redirect, not a real auth wall on the content itself.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_USER_AGENT } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
}

// GET /news/ lists recent articles, including whichever late-mail article
// is current — its slug carries the round number and changes each round,
// but there's no predictable URL pattern to construct directly (no RSS
// feed either — /news/rss, /rss, /news/feed all 404). Scanning the index
// for the first matching link is simpler and more reliable than guessing.
export async function findLatestLateMailUrl(): Promise<string | null> {
  const html = await fetchHtml("https://www.nrl.com/news/");
  const match = html.match(/href="(\/news\/\d{4}\/\d{2}\/\d{2}\/nrl-late-mail-round-\d+[^"]*)"/);
  return match ? `https://www.nrl.com${match[1]}` : null;
}

export interface ParsedPlayer {
  number: number;
  name: string;
  position: string;
}

export interface ParsedTeamSheet {
  teamName: string; // raw name as it appears on NRL.com, e.g. "Titans" — matched against Team.shortName by the caller
  starters: ParsedPlayer[]; // Backs + Forwards sections combined, in listed order (1-13)
  interchange: ParsedPlayer[];
  reserves: ParsedPlayer[];
  // True when reserves.length < 3 — NRL.com doesn't always name a full
  // three-player reserve bench, and assuming it does was the exact source
  // of a past manual-reading error. Surfaced, never silently assumed.
  reserveWarning: boolean;
}

export interface ParsedMatch {
  homeTeam: ParsedTeamSheet;
  awayTeam: ParsedTeamSheet;
  matchLabel: string; // e.g. "Titans v Dolphins, Friday 6.00pm at Cbus Super Stadium"
}

export interface ParsedLateMail {
  round: string | null;
  sourceUrl: string;
  matches: ParsedMatch[];
  // The article's own free-text commentary (injury notes, "held back"
  // caveats, etc.) — richer than the structured team-list widget alone,
  // shown to the admin as reference context, not parsed into structured
  // fields.
  narrative: string;
}

const MATCH_HEADER = /<h3>([^<]+?) v ([^<]+?), ([^<]+?)<\/h3>/g;

// "Position for Team is number N" — see lib note above: each player's own
// accessibility label is a complete, self-contained statement of their
// team/position/number, independent of the other side's. This is what the
// parser reads, NOT the adjacent visible number column — that column skips
// printing a second number when both sides share the same jersey number at
// a position (e.g. both wingers wearing #5), which looked like a "missing"
// number until traced back to the real (redundant-display, not missing-
// data) cause.
const A11Y_LABEL = /^(.+?) for (.+?) is number (\d+)$/;

function parsePlayerFromProfile($: cheerio.CheerioAPI, profile: ReturnType<cheerio.CheerioAPI>): ParsedPlayer | null {
  const label = profile.find(".u-visually-hidden").first().text().trim();
  const match = label.match(A11Y_LABEL);
  if (!match) return null; // this side of the row has no player (asymmetric starters/bench between the two teams)
  const [, position, , numberStr] = match;

  const nameDiv = profile.find(".team-list-profile__name");
  // The first name is a loose text node right before the bold-weight
  // surname span — cheerio's .text() on the whole div concatenates both,
  // then the visually-hidden label text (already extracted above) is
  // stripped back out, leaving just "Firstname Lastname".
  const fullText = nameDiv.text().replace(label, "").replace(/\s+/g, " ").trim();
  if (!fullText) return null;

  return { number: Number(numberStr), name: fullText, position };
}

// Backs/Forwards/Interchange/Reserves are each an <h4 class="teamsheet-
// group__title--sub"> immediately followed by a <ul> of <li class="team-
// list"> rows, split into home/away halves per row.
function parseSection(
  $: cheerio.CheerioAPI,
  heading: ReturnType<cheerio.CheerioAPI>
): { home: ParsedPlayer[]; away: ParsedPlayer[] } {
  const home: ParsedPlayer[] = [];
  const away: ParsedPlayer[] = [];
  const list = heading.nextAll("ul").first();
  list.find("li.team-list").each((_, li) => {
    const row = $(li);
    const homePlayer = parsePlayerFromProfile($, row.find(".team-list-profile--home"));
    const awayPlayer = parsePlayerFromProfile($, row.find(".team-list-profile--away"));
    if (homePlayer) home.push(homePlayer);
    if (awayPlayer) away.push(awayPlayer);
  });
  return { home, away };
}

function parseMatchChunk(chunkHtml: string, matchLabel: string): ParsedMatch {
  const $ = cheerio.load(chunkHtml);

  const homeStarters: ParsedPlayer[] = [];
  const awayStarters: ParsedPlayer[] = [];
  let homeInterchange: ParsedPlayer[] = [];
  let awayInterchange: ParsedPlayer[] = [];
  let homeReserves: ParsedPlayer[] = [];
  let awayReserves: ParsedPlayer[] = [];

  $("h4.teamsheet-group__title--sub").each((_, el) => {
    const heading = $(el);
    const label = heading.text().trim().toLowerCase();
    const { home, away } = parseSection($, heading);
    if (label === "backs" || label === "forwards") {
      homeStarters.push(...home);
      awayStarters.push(...away);
    } else if (label === "interchange") {
      homeInterchange = home;
      awayInterchange = away;
    } else if (label === "reserves") {
      homeReserves = home;
      awayReserves = away;
    }
  });

  const [homeName, awayName] = matchLabel.split(" v ").map((s) => s.split(",")[0]?.trim() ?? s.trim());

  return {
    matchLabel,
    homeTeam: {
      teamName: homeName,
      starters: homeStarters,
      interchange: homeInterchange,
      reserves: homeReserves,
      reserveWarning: homeReserves.length < 3,
    },
    awayTeam: {
      teamName: awayName,
      starters: awayStarters,
      interchange: awayInterchange,
      reserves: awayReserves,
      reserveWarning: awayReserves.length < 3,
    },
  };
}

export async function fetchLateMail(url: string): Promise<ParsedLateMail> {
  const html = await fetchHtml(url);

  const roundMatch = html.match(/<h2>NRL Late Mail: (Round \d+)<\/h2>/);
  const round = roundMatch ? roundMatch[1] : null;

  // Free-text narrative: everything inside the article's own content block,
  // stripped of tags — kept as reference context for the admin, not parsed
  // further. Falls back to "" rather than throwing if NRL.com restructures
  // this specific wrapper class.
  const $article = cheerio.load(html);
  const narrative = $article(".s-cms-content--article").first().text().replace(/\s+/g, " ").trim();

  // Match boundaries are just successive "X v Y, ..." <h3> headings in the
  // flowing article HTML, not individually wrapped containers — so each
  // match's content is whatever raw HTML sits between one heading and the
  // next (or end of document for the last match).
  const boundaries: { label: string; index: number }[] = [];
  for (const m of html.matchAll(MATCH_HEADER)) {
    boundaries.push({ label: `${m[1]} v ${m[2]}, ${m[3]}`, index: m.index! });
  }

  const matches: ParsedMatch[] = boundaries.map((b, i) => {
    const end = i + 1 < boundaries.length ? boundaries[i + 1].index : html.length;
    const chunk = html.slice(b.index, end);
    return parseMatchChunk(chunk, b.label);
  });

  return { round, sourceUrl: url, matches, narrative };
}
