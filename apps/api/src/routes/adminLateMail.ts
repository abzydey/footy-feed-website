import { Router } from "express";
import { z } from "zod";

import { requireAdmin } from "../middleware/adminAuth";
import { fetchLateMail, findLatestLateMailUrl } from "../lib/lateMailParser";
import { analyzeLateMail } from "../lib/lateMailAnalysis";

const router = Router();
router.use(requireAdmin);

const parseSchema = z.object({ url: z.string().url().optional() });

// POST /api/admin/late-mail/parse — fetches + parses NRL.com's Late Mail
// page (see lib/lateMailParser.ts) and returns structured data for review.
// Never writes anything: publishing a team's list is a separate, explicit
// POST /api/admin/events call the admin panel makes per team after review,
// reusing the exact same endpoint every other team-list entry already goes
// through — this route has no side effects of its own. The actual
// matching/shape-checking/body-generation work is shared with
// lib/lateMailPoller.ts (the automatic version of this same flow) via
// lib/lateMailAnalysis.ts, so a manually-reviewed list and an
// auto-published one are generated identically.
router.post("/parse", async (req, res) => {
  const parsed = parseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const url = parsed.data.url ?? (await findLatestLateMailUrl().catch(() => null));
  if (!url) {
    return res.status(502).json({ error: "Couldn't find a current Late Mail article on nrl.com/news/ — pass a url explicitly." });
  }

  let lateMail;
  try {
    lateMail = await fetchLateMail(url);
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch/parse ${url}: ${err instanceof Error ? err.message : err}` });
  }

  const matches = await analyzeLateMail(lateMail);
  res.json({ round: lateMail.round, sourceUrl: lateMail.sourceUrl, narrative: lateMail.narrative, matches });
});

export default router;
