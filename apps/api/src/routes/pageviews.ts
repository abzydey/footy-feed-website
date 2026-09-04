import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";

const router = Router();

// The fixed set of top-level pages tracked — deliberately small and
// hand-picked rather than every route, so this stays "simple counts per
// page" rather than growing into full analytics. Each maps to a section of
// the site as the user thinks of it, not a literal URL (e.g. a team detail
// page counts under "teams"). See web/src/App.tsx for where each route maps
// to one of these labels.
export const PAGES = ["home", "news", "teams", "games", "team-lists", "ladder", "social", "podcasts", "highlights", "judiciary"] as const;

const pageViewSchema = z.object({
  page: z.enum(PAGES),
});

// POST /api/pageviews — fire-and-forget from the frontend on each route
// change. No session/device id — this counts views, not unique visitors,
// which is enough to see whether a page is getting looked at at all.
router.post("/", async (req, res) => {
  const parsed = pageViewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  await prisma.pageView.create({ data: { page: parsed.data.page } });
  res.status(201).end();
});

export default router;
