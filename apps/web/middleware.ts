import { next } from "@vercel/edge";

// Vercel Edge Middleware: runs before vercel.json's rewrites (which send
// every page path to /index.html for the Vite SPA). This is the site's SEO
// layer. The SPA sets each page's title/description/canonical in the
// browser (lib/useDocumentMeta.ts), but anything that reads the raw HTML —
// link-preview bots (X, Slack, iMessage, Facebook), Bing, and Google's
// first pass before it renders JS — would otherwise only ever see
// index.html's generic homepage tags on every URL.
//
// So for every page request this serves index.html with the page's real
// <title>, description, canonical URL, robots, Open Graph/Twitter tags and
// schema.org data written into <head>, plus the story text itself inside
// #root for news pages (React replaces it as soon as the app mounts — same
// content, so it's not cloaking). A missing article/story/team/game, or a
// path no route matches, gets a real 404 status + noindex instead of a
// blank 200 page. Any failure (API slow or down) falls straight through to
// the plain SPA via next(), so this can never take the site down.
//
// Keep ROUTES/STATIC_META in step with App.tsx's <Routes>: a page missing
// here is served as a 404 to search engines (it still works for people).
export const config = {
  // Page paths only — not /assets, /brand, /flags, /partners, the sitemap
  // or anything with a file extension (which includes /index.html itself,
  // fetched below, so this can't loop).
  matcher: ["/((?!assets/|brand/|flags/|partners/|sitemap\\.xml)[^.]*)"],
};

const SITE_URL = "https://www.fullset.au";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
// Same API the SPA talks to (see lib/api.ts) — server-to-server from the
// edge, so no browser CORS involved.
const API_URL = "https://footy-feedapi-production.up.railway.app/api";
const TIMEOUT_MS = 2500;

interface PageMeta {
  title: string; // page part only; " | Full Set" is appended
  description: string;
  path: string; // canonical path
  type?: "website" | "article";
  noindex?: boolean;
  status?: number;
  jsonLd?: object;
  bodyHtml?: string; // pre-rendered content for inside #root
}

const STATIC_META: Record<string, Omit<PageMeta, "path">> = {
  "/": {
    title: "NRL News, Team Lists & Ladder",
    description:
      "Your team. The full set. Real-time NRL news, official team lists, injury updates, fixtures, and ladder standings — one page per club.",
  },
  "/news": { title: "NRL News", description: "Breaking league-wide NRL stories, not tied to one club." },
  "/teams": { title: "All NRL Teams", description: "Every NRL club — team lists, injuries, news, and ladder position, all in one place." },
  "/games": { title: "Fixtures", description: "NRL fixtures and results by round — kickoff times, venues, and full-time scores for every club." },
  "/team-lists": { title: "Team Lists", description: "Official NRL team lists for the current round — Initial, 24hr, and Final, as they're released." },
  "/ladder": { title: "NRL Ladder", description: "Full NRL ladder standings — points, wins, losses, points diff, and finals cutoff, updated every round." },
  "/finals": { title: "NRL Finals Hub", description: "NRL finals — the bracket, results, and who's in and out for every finals game." },
  "/social": { title: "NRL Social", description: "The best NRL reactions and chatter from X, all in one feed." },
  "/podcasts": { title: "NRL Podcasts", description: "The latest NRL podcast episodes — panel shows, interviews, and analysis, all in one place." },
  "/highlights": { title: "NRL Highlights", description: "Full match highlights from every NRL game, as they're posted." },
  "/judiciary": { title: "Judiciary", description: "NRL Match Review Committee outcomes — charges, grades, suspensions and fines, round by round." },
  "/injuries": { title: "Injuries", description: "Every NRL club's current injury and availability list in one place — player, status, and details." },
  "/signings": { title: "NRL Signings Tracker", description: "Every confirmed NRL signing, re-signing and departure, club by club." },
  "/world-cup": { title: "Rugby League World Cup 2026", description: "Men's Rugby League World Cup 2026 fixtures, results, pool tables and news." },
  "/world-cup/teams": { title: "World Cup teams & squads", description: "Every men's Rugby League World Cup 2026 nation and its announced squad." },
  "/about": { title: "About", description: "About Full Set — a fan-focused companion for NRL supporters, with a page for every club." },
  "/feed/top": { title: "Top Stories", description: "The biggest NRL stories right now." },
  "/feed/signings": { title: "Signing News", description: "The latest NRL signing news." },
  "/feed/my-teams": { title: "My Teams", description: "News from the clubs you follow.", noindex: true },
  "/search": { title: "Search", description: "Search NRL podcast transcripts, chapters, and episodes on Full Set.", noindex: true },
  "/admin": { title: "Admin", description: "Full Set admin.", noindex: true },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function api<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

const notFound = (path: string): PageMeta => ({
  title: "Page not found",
  description: "This page doesn't exist on Full Set.",
  path,
  noindex: true,
  status: 404,
});

const publisher = { "@type": "Organization", name: "Full Set", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` } };

// The article's markdown (paragraphs, "## " headings, *emphasis*) as plain
// HTML — same subset lib/markdown.tsx renders in the app.
function markdownToHtml(md: string): string {
  return md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      const inline = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      if (t.startsWith("## ")) return `<h2>${inline(t.slice(3))}</h2>`;
      if (t.startsWith("# ")) return `<h2>${inline(t.slice(2))}</h2>`;
      return `<p>${inline(t)}</p>`;
    })
    .join("");
}

const articleShell = (inner: string) => `<article style="max-width:42rem;margin:0 auto;padding:2rem 1rem">${inner}</article>`;

interface Story {
  id: string;
  headline: string;
  body: string;
  articleBody?: string | null;
  slug: string | null;
  createdAt: string;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceName: string | null;
  canonicalPath?: string;
}

async function metaFor(path: string): Promise<PageMeta> {
  const fixed = STATIC_META[path];
  if (fixed) return { ...fixed, path };

  let m: RegExpMatchArray | null;

  if ((m = path.match(/^\/news\/([^/]+)$/))) {
    const a = await api<Story>(`/articles/${encodeURIComponent(m[1])}`);
    if (!a) return notFound(path);
    const canonical = a.canonicalPath ?? path;
    return {
      title: a.headline,
      description: a.body,
      path: canonical,
      type: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: a.headline,
        description: a.body,
        datePublished: a.createdAt,
        image: [DEFAULT_OG_IMAGE],
        mainEntityOfPage: `${SITE_URL}${canonical}`,
        author: { "@type": "Organization", name: "Full Set", url: SITE_URL },
        publisher,
      },
      bodyHtml: articleShell(`<h1>${escapeHtml(a.headline)}</h1>${markdownToHtml(a.articleBody ?? a.body)}`),
    };
  }

  if ((m = path.match(/^\/story\/([^/]+)$/))) {
    const s = await api<Story>(`/feed/${encodeURIComponent(m[1])}`);
    if (!s) return notFound(path);
    const canonical = s.canonicalPath ?? path;
    const credit = [s.sourceAuthor, s.sourceName].filter(Boolean).join(", ");
    return {
      title: s.headline,
      description: s.body.length > 300 ? `${s.body.slice(0, 297)}…` : s.body,
      path: canonical,
      type: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: s.headline,
        description: s.body,
        datePublished: s.createdAt,
        mainEntityOfPage: `${SITE_URL}${canonical}`,
        publisher,
        ...(s.sourceAuthor ? { author: s.sourceAuthor.split(/,\s*/).map((name) => ({ "@type": "Person", name })) } : {}),
        ...(s.sourceUrl ? { isBasedOn: s.sourceUrl } : {}),
      },
      bodyHtml: articleShell(
        `<h1>${escapeHtml(s.headline)}</h1><p>${escapeHtml(s.body)}</p>` +
          (credit ? `<p>By ${escapeHtml(credit)}${s.sourceUrl ? ` — <a href="${escapeHtml(s.sourceUrl)}" rel="nofollow">read the full story</a>` : ""}</p>` : "")
      ),
    };
  }

  if ((m = path.match(/^\/teams\/([^/]+)$/))) {
    const t = await api<{ team: { name: string; slug: string } }>(`/teams/${encodeURIComponent(m[1])}`);
    if (!t) return notFound(path);
    return {
      title: t.team.name,
      description: `${t.team.name} on Full Set — team lists, injury news, fixtures, and ladder position, updated in real time.`,
      path: `/teams/${t.team.slug}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsTeam",
        name: t.team.name,
        sport: "Rugby league",
        memberOf: { "@type": "SportsOrganization", name: "National Rugby League" },
        url: `${SITE_URL}/teams/${t.team.slug}`,
      },
    };
  }

  if ((m = path.match(/^\/games\/([^/]+)$/))) {
    const r = await api<{ game: {
      id: string;
      round: string;
      status: string;
      kickoffAt: string;
      venue: string | null;
      homeScore: number | null;
      awayScore: number | null;
      homeTeam: { name: string; shortName: string };
      awayTeam: { name: string; shortName: string };
    } }>(`/games/${encodeURIComponent(m[1])}`);
    if (!r) return notFound(path);
    const g = r.game;
    const matchup = `${g.homeTeam.shortName} v ${g.awayTeam.shortName}`;
    const finished = g.status === "FULL_TIME";
    return {
      title: `${matchup} — ${g.round}`,
      description: finished
        ? `Full time: ${g.homeTeam.shortName} ${g.homeScore}-${g.awayScore} ${g.awayTeam.shortName}. Try scorers, team lists, and match news on Full Set.`
        : `${matchup} — ${g.round}. Kickoff, venue, team lists, and build-up on Full Set.`,
      path: `/games/${g.id}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: `${g.homeTeam.name} v ${g.awayTeam.name}`,
        sport: "Rugby league",
        startDate: g.kickoffAt,
        ...(g.venue ? { location: { "@type": "Place", name: g.venue } } : {}),
        homeTeam: { "@type": "SportsTeam", name: g.homeTeam.name },
        awayTeam: { "@type": "SportsTeam", name: g.awayTeam.name },
      },
    };
  }

  if ((m = path.match(/^\/world-cup\/teams\/([^/]+)$/))) {
    const abbr = m[1].toUpperCase();
    const matches = await api<{ homeAbbr: string; homeName: string; awayAbbr: string; awayName: string }[]>(`/world-cup/matches`);
    const hit = matches?.find((x) => x.homeAbbr === abbr || x.awayAbbr === abbr);
    if (!hit) return notFound(path);
    const name = hit.homeAbbr === abbr ? hit.homeName : hit.awayName;
    return {
      title: `${name} — World Cup squad`,
      description: `${name}'s men's Rugby League World Cup 2026 squad and fixtures.`,
      path: `/world-cup/teams/${m[1]}`,
    };
  }

  if ((m = path.match(/^\/world-cup\/([^/]+)$/))) {
    const r = await api<{ match: { id: string; homeName: string; awayName: string; roundName: string; kickoffAt: string; venue: string | null } }>(
      `/world-cup/matches/${encodeURIComponent(m[1])}`
    );
    if (!r) return notFound(path);
    const x = r.match;
    return {
      title: `${x.homeName} v ${x.awayName} — World Cup ${x.roundName}`,
      description: `Team lists for ${x.homeName} v ${x.awayName}, Rugby League World Cup ${x.roundName}.`,
      path: `/world-cup/${x.id}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: `${x.homeName} v ${x.awayName} — Rugby League World Cup 2026`,
        sport: "Rugby league",
        startDate: x.kickoffAt,
        ...(x.venue ? { location: { "@type": "Place", name: x.venue } } : {}),
      },
    };
  }

  return notFound(path);
}

function injectMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(`${meta.title} | Full Set`);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(`${SITE_URL}${meta.path}`);
  const robots = meta.noindex ? "noindex, follow" : "index, follow, max-image-preview:large";

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${meta.type ?? "website"}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta\s+property="og:title"[\s\S]*?\/>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"[\s\S]*?\/>/, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta\s+name="twitter:title"[\s\S]*?\/>/, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"[\s\S]*?\/>/, `<meta name="twitter:description" content="${description}" />`);

  const extra =
    `<link rel="canonical" href="${url}" />\n<meta name="robots" content="${robots}" />\n` +
    (meta.jsonLd ? `<script type="application/ld+json" id="ssr-jsonld">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>\n` : "");
  out = out.replace("</head>", `${extra}</head>`);

  if (meta.bodyHtml) out = out.replace(/<div id="root"><\/div>/, `<div id="root">${meta.bodyHtml}</div>`);
  return out;
}

export default async function middleware(request: Request) {
  // Only full page loads — not prefetches of JSON etc.
  if (request.method !== "GET") return next();
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";

  try {
    const [meta, shell] = await Promise.all([
      metaFor(path),
      fetch(new URL("/index.html", url), { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => {
        if (!r.ok) throw new Error(`index.html ${r.status}`);
        return r.text();
      }),
    ]);
    return new Response(injectMeta(shell, meta), {
      status: meta.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate" },
    });
  } catch {
    return next();
  }
}
