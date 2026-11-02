---
name: no-local-full-api
description: Never run apps/api src/index.ts locally — it starts every background poller against the live DB; preview with a route-only server
metadata:
  node_type: memory
  type: feedback
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-29T11:43:21.893Z
---

Don't start the full API locally (`npx tsx src/index.ts`): it starts the Late Mail, World Cup, social, podcast and live-score pollers against the production Neon database, so they could double-publish team lists or posts alongside Railway. Happened once on 2026-10-29; no duplicates resulted.

**Why:** there is only one database (see [[db-singapore-move]]); local and Railway pollers would both write to it.

**How to apply:** for a UI preview, run a throwaway express server that mounts only the route being tested and passes every other `/api` GET through to `https://footy-feedapi-production.up.railway.app`, with the web app pointed at it via `VITE_API_URL`. Delete the throwaway file before committing.
