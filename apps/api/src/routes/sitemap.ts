import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// The site's one public address. fullset.au redirects here (Vercel's
// primary domain is www), so every URL we hand a search engine uses it
// directly rather than pointing at a redirect.
const SITE_URL = "https://www.fullset.au";

// Static routes worth indexing — deliberately excludes /admin (see
// robots.txt), /search (result pages), and /feed/* (personal or
// re-filtered copies of /news).
const STATIC_PATHS = [
  "/",
  "/news",
  "/teams",
  "/games",
  "/ladder",
  "/team-lists",
  "/injuries",
  "/judiciary",
  "/signings",
  "/world-cup",
  "/world-cup/teams",
  "/finals",
  "/social",
  "/podcasts",
  "/highlights",
  "/about",
];

function urlEntry(path: string, lastmod?: Date | null) {
  const loc = `${SITE_URL}${path}`;
  const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${loc}</loc>${lastmodTag}</url>`;
}

// GET /sitemap.xml — generated live from the real database on every request
// rather than a static file, so new stories, teams and games are
// discoverable immediately with no manual regeneration step.
router.get("/", async (_req, res) => {
  const [teams, games, stories, worldCupMatches, squads] = await Promise.all([
    prisma.team.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.game.findMany({ select: { id: true, kickoffAt: true } }),
    // Oldest first, so the first copy seen per story is its canonical one.
    prisma.event.findMany({
      where: { type: { in: ["GENERAL_NEWS", "TRANSFER"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, headline: true, sourceUrl: true, isOriginalArticle: true, slug: true, createdAt: true, updatedAt: true },
    }),
    prisma.worldCupMatch.findMany({ select: { id: true, kickoffAt: true } }),
    prisma.worldCupSquad.findMany({ select: { abbr: true, updatedAt: true } }),
  ]);

  // One URL per story: its earliest copy, the same canonical every copy's
  // page declares (lib/canonical.ts).
  const seen = new Set<string>();
  const storyEntries: string[] = [];
  for (const s of stories) {
    const key = `${s.headline}|${s.sourceUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const path = s.isOriginalArticle && s.slug ? `/news/${s.slug}` : `/story/${s.id}`;
    storyEntries.push(urlEntry(path, s.updatedAt ?? s.createdAt));
  }

  const entries = [
    ...STATIC_PATHS.map((p) => urlEntry(p)),
    ...teams.map((t) => urlEntry(`/teams/${t.slug}`, t.updatedAt)),
    ...games.map((g) => urlEntry(`/games/${g.id}`, g.kickoffAt)),
    ...worldCupMatches.map((m) => urlEntry(`/world-cup/${m.id}`, m.kickoffAt)),
    ...squads.map((s) => urlEntry(`/world-cup/teams/${s.abbr}`, s.updatedAt)),
    ...storyEntries,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  res.type("application/xml").send(xml);
});

export default router;
