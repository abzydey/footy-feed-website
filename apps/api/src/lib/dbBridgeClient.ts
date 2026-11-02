import "dotenv/config";

import { execFile } from "child_process";

import jwt from "jsonwebtoken";

// Cloud sessions can't open a database connection, only web requests, so when
// DB_BRIDGE_URL is set, lib/prisma.ts hands out this client instead. Each
// prisma.model.method(args) call is sent to the live API, which runs it (see
// routes/adminDbBridge.ts). Every script works unchanged. Railway never sets
// DB_BRIDGE_URL, so the API itself always uses the real client.
//
// Requests go through curl because Node's fetch ignores the cloud's proxy.

const READ_METHODS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function post(url: string, token: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "curl",
      ["-sS", "--max-time", "120", "-X", "POST", "-H", "Content-Type: application/json", "-H", `Authorization: Bearer ${token}`, "--data-binary", "@-", "-w", "\n%{http_code}", url],
      { maxBuffer: 100 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout))
    );
    child.stdin?.end(body);
  });
}

export async function callBridge(path: string, payload: unknown, attempts = 1): Promise<unknown> {
  const base = process.env.DB_BRIDGE_URL;
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!base || !secret) throw new Error("DB_BRIDGE_URL and ADMIN_JWT_SECRET must both be set");
  const token = jwt.sign({ id: "cloud-session", email: "cloud-session", scope: "db-bridge" }, secret, { expiresIn: "5m" });

  let output = "";
  for (let attempt = 1; ; attempt++) {
    try {
      output = await post(`${base.replace(/\/$/, "")}/api/admin/db-bridge${path}`, token, JSON.stringify(payload));
      break;
    } catch (err) {
      if (attempt >= attempts) throw err;
    }
  }

  const split = output.lastIndexOf("\n");
  const status = Number(output.slice(split + 1));
  const parsed = JSON.parse(output.slice(0, split) || "{}", (_key, value) =>
    typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value
  );
  if (status !== 200) {
    throw Object.assign(new Error(parsed.error ?? `Bridge returned ${status}`), { code: parsed.code, meta: parsed.meta });
  }
  return parsed.result;
}

export function createBridgeClient(): unknown {
  const client: unknown = new Proxy(
    {},
    {
      get(_target, model) {
        if (typeof model !== "string" || model === "then") return undefined;
        if (model === "$disconnect" || model === "$connect") return async () => undefined;
        if (model === "$transaction") {
          // Not atomic: an array runs as it was already sent, and a callback
          // gets this same client.
          return (work: unknown) => (typeof work === "function" ? work(client) : Promise.all(work as unknown[]));
        }
        if (model.startsWith("$")) {
          return () => {
            throw new Error(`prisma.${model} is not available through the database bridge`);
          };
        }
        return new Proxy(
          {},
          {
            get(_t, method) {
              if (typeof method !== "string" || method === "then") return undefined;
              return (args?: unknown) => callBridge("", { model, method, args }, READ_METHODS.has(method) ? 3 : 1);
            },
          }
        );
      },
    }
  );
  return client;
}
