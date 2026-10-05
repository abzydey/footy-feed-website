import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";

const router = Router();

export const PAGES = ["home", "news", "teams", "games", "team-lists", "ladder", "social", "podcasts", "highlights", "judiciary"] as const;

const pageViewSchema = z.object({
  page: z.enum(PAGES),
  // Anonymous per-browser id (see web lib/visitor.ts) — optional so an
  // older app build that doesn't send one still counts as a view.
  visitorId: z.string().uuid().optional(),
});

// Local test copies of the site (vite dev/preview on http://localhost:<port>
// or 127.0.0.1) call the live API too — those views aren't real visitors.
// The Android app's origin is https://localhost and the iOS app's
// capacitor://localhost, so this only matches plain-http localhost.
const LOCAL_TEST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

router.post("/", async (req, res) => {
  if (LOCAL_TEST_ORIGIN.test(req.get("origin") ?? "")) return res.status(204).end();

  const parsed = pageViewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  await prisma.pageView.create({ data: { page: parsed.data.page, visitorId: parsed.data.visitorId } });
  res.status(201).end();
});

export default router;
