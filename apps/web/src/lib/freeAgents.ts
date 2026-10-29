import { FreeAgent, FreeAgentTier, TransferTeam } from "./api";
import { teamColors } from "./teamBadge";

// Free agency: players off contract at the end of 2027 can talk to rival
// clubs from this moment (1 Nov 2026, Sydney time).
export const TALKS_OPEN_AT = new Date("2026-11-01T00:00:00+11:00").getTime();
// Home promotes the tracker until the market has mostly settled.
export const FREE_AGENCY_ON_HOME_UNTIL = new Date("2026-12-15T00:00:00+11:00").getTime();

export const TIER_ORDER: FreeAgentTier[] = ["MARQUEE", "STAR", "ESTABLISHED", "VALUE", "RISING"];

export const TIER_LABEL: Record<FreeAgentTier, string> = {
  MARQUEE: "Marquee",
  STAR: "Stars",
  ESTABLISHED: "Established",
  VALUE: "Value buys",
  RISING: "Rising stars",
};

export const TIER_BLURB: Record<FreeAgentTier, string> = {
  MARQUEE: "The players a club builds around.",
  STAR: "Origin and Test quality.",
  ESTABLISHED: "Proven first-graders.",
  VALUE: "Bargain buys.",
  RISING: "The next wave.",
};

// Off the market: re-signed, signed elsewhere or retired.
export const isDone = (p: FreeAgent) => p.status !== "AVAILABLE";

const shortName = (t: TransferTeam | null, label: string | null) => t?.shortName ?? label ?? "new club";

// "Re-signed to 2029", "Signed with Bears", "Retired".
export function outcomeText(p: FreeAgent): string {
  if (p.status === "RE_SIGNED") return p.until ? `Re-signed to ${p.until}` : "Re-signed";
  if (p.status === "SIGNED") return `Signed with ${shortName(p.newTeam, p.newTeamLabel)}${p.until ? ` to ${p.until}` : ""}`;
  if (p.status === "RETIRED") return "Retired";
  return "Available";
}

// Biggest names first: by tier, then name.
export function byTier(a: FreeAgent, b: FreeAgent): number {
  const ta = a.tier ? TIER_ORDER.indexOf(a.tier) : 99;
  const tb = b.tier ? TIER_ORDER.indexOf(b.tier) : 99;
  return ta - tb || a.player.localeCompare(b.player);
}

// A club's colour that still shows on navy, else Full Set Purple.
export function clubAccent(team: TransferTeam | null): string {
  if (!team) return "#A855F7";
  return teamColors({ slug: team.slug, primaryColor: team.primaryColor ?? null }).find((c) => luminance(c) > 0.12) ?? "#A855F7";
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// ---------------------------------------------------------------------------
// Social graphics (1080×1350, the Instagram/X portrait size), drawn on a
// canvas from the live list so a post is always up to date. Brand colours
// and fonts are fixed here (not the theme variables): posts are always the
// dark navy look, whatever theme the person making them uses.
// ---------------------------------------------------------------------------

export type GraphicKind = "top" | "available" | "club";

const W = 1080;
const H = 1350;
const PAD = 64;
const NAVY = "#0B1533";
const PURPLE = "#A855F7";
const WHITE = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.42)";
const SOFT = "rgba(255,255,255,0.62)";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Shrinks the font until the text fits, then cuts it with an ellipsis.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, size: number, min: number) {
  let s = size;
  ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = font(s);
  }
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = t.slice(0, -2) + "…";
  return t;
}

function spaced(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
}

const display = (size: number) => `italic 900 ${size}px Saira, sans-serif`;
const body = (weight: number) => (size: number) => `${weight} ${size}px Archivo, sans-serif`;

// "→ BEARS", "RE-SIGNED", "RETIRED" — the short label next to a crossed-off name.
// compact (the three-column grid) keeps it short so the name still fits.
function outcomeTag(p: FreeAgent, compact = false): string {
  if (p.status === "RE_SIGNED") return compact ? "STAYS" : p.until ? `RE-SIGNED '${String(p.until).slice(2)}` : "RE-SIGNED";
  if (p.status === "SIGNED") return `→ ${shortName(p.newTeam, p.newTeamLabel).toUpperCase()}`;
  return "RETIRED";
}

interface Row {
  p: FreeAgent;
  sub?: string; // second detail after the name (club or position)
}

// One name in a grid cell: club colour bar, the name (struck through in
// purple once he's off the market) and, if he is, where he went.
function drawRow(ctx: CanvasRenderingContext2D, r: Row, x: number, y: number, w: number, size: number, compact: boolean) {
  const done = isDone(r.p);
  const barH = Math.round(size * 1.05);
  ctx.fillStyle = clubAccent(r.p.team);
  ctx.globalAlpha = done ? 0.45 : 1;
  ctx.fillRect(x, y - barH / 2, 5, barH);
  ctx.globalAlpha = 1;

  const tag = done ? outcomeTag(r.p, compact) : r.sub ?? "";
  spaced(ctx, done ? 1 : 0);
  ctx.font = done ? body(800)(Math.round(size * 0.62)) : body(600)(Math.round(size * 0.7));
  const tagW = tag ? ctx.measureText(tag).width : 0;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = done ? PURPLE : MUTED;
  if (tag) ctx.fillText(tag, x + w, y + 1);
  spaced(ctx, 0);

  ctx.textAlign = "left";
  const nameX = x + 18;
  const name = fitText(ctx, r.p.player, w - 18 - (tag ? tagW + 14 : 0), body(700), size, Math.round(size * 0.66));
  ctx.fillStyle = done ? MUTED : WHITE;
  ctx.fillText(name, nameX, y);
  if (done) {
    const nw = ctx.measureText(name).width;
    ctx.fillStyle = PURPLE;
    ctx.fillRect(nameX - 3, y - 1, nw + 6, Math.max(3, Math.round(size / 9)));
  }
}

export interface GraphicInput {
  kind: GraphicKind;
  players: FreeAgent[]; // the whole list
  club?: TransferTeam | null; // for "club"
  season: number;
}

export async function drawFreeAgencyGraphic(canvas: HTMLCanvasElement, input: GraphicInput): Promise<void> {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await Promise.all([
    document.fonts.load(display(80)),
    document.fonts.load(body(700)(30)),
    document.fonts.load(body(800)(30)),
    document.fonts.load(body(600)(30)),
  ]).catch(() => {});

  // Background: navy with the brand's purple glow.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.88, 40, 0, W * 0.88, 40, W * 0.85);
  glow.addColorStop(0, "rgba(168,85,247,0.34)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const { kind, players, club, season } = input;
  let list: FreeAgent[];
  let title: string;
  let rows: Row[];
  let cols: number;
  let stat: string;
  let share: number; // how full the progress bar is
  if (kind === "top") {
    list = players.filter((p) => p.tier).sort(byTier);
    title = "TOP FREE AGENTS";
    rows = list.map((p) => ({ p }));
    cols = 3;
    stat = `${list.filter(isDone).length} of ${list.length} off the market`;
    share = list.length ? list.filter(isDone).length / list.length : 0;
  } else if (kind === "available") {
    const top = players.filter((p) => p.tier);
    list = top.filter((p) => !isDone(p)).sort(byTier).slice(0, 30);
    title = "STILL AVAILABLE";
    rows = list.map((p) => ({ p, sub: p.team?.shortName.toUpperCase() }));
    cols = 2;
    stat = `${top.length - top.filter(isDone).length} of ${top.length} top free agents unsigned`;
    share = top.length ? top.filter(isDone).length / top.length : 0;
  } else {
    list = players.filter((p) => p.team?.id === club?.id).sort(byTier);
    title = (club?.shortName ?? "CLUB").toUpperCase();
    rows = list.map((p) => ({ p, sub: p.position?.toUpperCase() }));
    cols = list.length > 14 ? 2 : 1;
    stat = `${list.filter(isDone).length} of ${list.length} off-contract players signed`;
    share = list.length ? list.filter(isDone).length / list.length : 0;
  }

  // Header.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  spaced(ctx, 5);
  ctx.font = body(800)(26);
  ctx.fillStyle = PURPLE;
  ctx.fillText(`NRL FREE AGENCY · ${season}`, PAD, 112);
  spaced(ctx, 0);
  ctx.fillStyle = WHITE;
  ctx.fillText(fitText(ctx, title, W - PAD * 2, display, 96, 56), PAD, 206);

  // Progress: the share of the list that's off the market.
  const barY = 240;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(PAD, barY, W - PAD * 2, 10);
  ctx.fillStyle = PURPLE;
  ctx.fillRect(PAD, barY, (W - PAD * 2) * share, 10);
  ctx.font = body(700)(30);
  ctx.fillStyle = SOFT;
  ctx.fillText(stat, PAD, barY + 56);

  // Names.
  const top = 350;
  const bottom = H - 150;
  const perCol = Math.max(1, Math.ceil(rows.length / cols));
  const rowH = Math.min(cols === 1 ? 62 : cols === 2 ? 56 : 44, (bottom - top) / perCol);
  const size = Math.round(Math.min(cols === 3 ? 25 : cols === 2 ? 30 : 34, rowH * 0.58));
  const gap = 34;
  const colW = (W - PAD * 2 - gap * (cols - 1)) / cols;
  rows.forEach((r, i) => {
    const c = Math.floor(i / perCol);
    const k = i % perCol;
    drawRow(ctx, r, PAD + c * (colW + gap), top + k * rowH + rowH / 2, colW, size, cols === 3);
  });
  if (rows.length === 0) {
    ctx.font = body(700)(34);
    ctx.fillStyle = SOFT;
    ctx.textBaseline = "middle";
    ctx.fillText(kind === "available" ? "Every top free agent has signed." : "No players off contract.", PAD, top + 40);
  }

  // Footer: the Full Set lockup and the address.
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(PAD, H - 118, W - PAD * 2, 2);
  try {
    const logo = await loadImage("/brand/fullset-header-lockup.svg");
    const lh = 52;
    ctx.drawImage(logo, PAD, H - 86, (logo.naturalWidth / logo.naturalHeight) * lh, lh);
  } catch {
    /* the address alone still credits us */
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = body(700)(26);
  ctx.fillStyle = SOFT;
  ctx.fillText("fullset.au/free-agents", W - PAD, H - 60);
}
