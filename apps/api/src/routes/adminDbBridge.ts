import { Prisma } from "@prisma/client";
import { Router } from "express";

import { notifyFollowersOfEvent } from "../lib/notify";
import { prisma } from "../lib/prisma";
import { AdminAuthedRequest, requireAdmin } from "../middleware/adminAuth";

// Runs database calls for cloud sessions, which can only make web requests
// (see lib/dbBridgeClient.ts). Takes only tokens minted for this purpose with
// ADMIN_JWT_SECRET, so a logged-in admin panel token cannot use it. Admin
// accounts (password hashes) are out of reach.
const router = Router();

const METHODS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);
const NEEDS_WHERE = new Set(["updateMany", "deleteMany"]);
const MODELS = new Set(
  Object.values(Prisma.ModelName)
    .filter((name) => name !== "AdminUser")
    .map((name) => name[0].toLowerCase() + name.slice(1))
);

router.use(requireAdmin, (req: AdminAuthedRequest, res, next) => {
  if ((req.admin as { scope?: string } | undefined)?.scope !== "db-bridge") {
    return res.status(403).json({ error: "This token cannot use the database bridge" });
  }
  next();
});

router.post("/", async (req, res) => {
  const { model, method, args } = req.body ?? {};
  if (!MODELS.has(model) || !METHODS.has(method)) {
    return res.status(400).json({ error: `Not allowed: ${model}.${method}` });
  }
  if (NEEDS_WHERE.has(method) && !Object.keys(args?.where ?? {}).length) {
    return res.status(400).json({ error: `${method} needs a where filter` });
  }

  try {
    const delegate = (prisma as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[model];
    const result = await delegate[method](args);
    console.log(`[dbBridge] ${model}.${method}`);
    res.json({ result: result ?? null });
  } catch (err) {
    const e = err as { message?: string; code?: string; meta?: unknown };
    console.error(`[dbBridge] ${model}.${method} failed:`, e.code ?? e.message);
    res.status(422).json({ error: e.message ?? "Database call failed", code: e.code, meta: e.meta });
  }
});

// Push notifications go out from here, so the session needs no Firebase key.
router.post("/notify", async (req, res) => {
  const { eventId } = req.body ?? {};
  if (typeof eventId !== "string") return res.status(400).json({ error: "eventId required" });
  try {
    await notifyFollowersOfEvent(eventId);
    res.json({ result: true });
  } catch (err) {
    console.error("[dbBridge] notify failed:", (err as Error).message);
    res.status(422).json({ error: (err as Error).message });
  }
});

export default router;
