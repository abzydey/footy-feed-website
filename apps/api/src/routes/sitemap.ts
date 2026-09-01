import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

const SITE_URL = "https://fullset.au";

// Static routes worth indexing — deliberately excludes /admin (see
// robots.txt) and one-off/utility routes like /search that don't benefit
// from a search-engine crawl.
const STATIC_PATHS = ["/", "/teams", "/games", "/ladder", "/team-lists", "/news", "/social", "/podcasts", "/about"];

function urlEntry(path: string, lastmod?: Date | null) {
  const loc = `${SITE_URL}${path}`;
  const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${loc}</loc>${lastmodTag}</url>`;
}

// GET /sitemap.xml — generated live from the real database on every request
// rather than a static file, so newly added teams/games are discoverable
// immediately with no manual regeneration step. Cheap enough at this data
// volume (a season's worth of teams/games) to not need caching.
router.get("/", async (_req, res) => {
  const [teams, games] = await Promise.all([
    prisma.team.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.game.findMany({ select: { id: true, kickoffAt: true } }),
  ]);

  const entries = [
    ...STATIC_PATHS.map((p) => urlEntry(p)),
    ...teams.map((t) => urlEntry(`/teams/${t.slug}`, t.updatedAt)),
    ...games.map((g) => urlEntry(`/games/${g.id}`, g.kickoffAt)),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  res.type("application/xml").send(xml);
});

export default router;
