import { Router } from "express";

import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/articles/:slug — the one public read path for a Full Set
// original article (isOriginalArticle: true). Deliberately its own file
// rather than added to routes/events.ts, which is entirely mounted behind
// requireAdmin (see index.ts) — this is the one Event read that needs to be
// public, since /news/:slug is a real page fans (and link-preview crawlers,
// see the Vercel edge function that also reads this route) load directly.
router.get("/:slug", async (req, res) => {
  const article = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    include: { team: { select: { id: true, name: true, shortName: true, slug: true } } },
  });

  // Also 404 for a real-but-not-an-article event (isOriginalArticle: false
  // has slug: null so this can't actually happen, but guards against it
  // meaning anything other than "this isn't a published article" if the
  // data ever changes shape) — never leaks a non-article Event through this
  // route just because its slug happened to match.
  if (!article || !article.isOriginalArticle) {
    return res.status(404).json({ error: "Article not found" });
  }

  res.json(article);
});

export default router;
