import { PrismaClient } from "@prisma/client";

import { createBridgeClient } from "./dbBridgeClient";

// Reuse a single PrismaClient across hot reloads in dev (tsx watch)
// instead of opening a new connection pool on every file change.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Cloud sessions reach the database through the API: see lib/dbBridgeClient.ts.
export const prisma: PrismaClient =
  global.__prisma ?? (process.env.DB_BRIDGE_URL ? (createBridgeClient() as PrismaClient) : new PrismaClient());

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
