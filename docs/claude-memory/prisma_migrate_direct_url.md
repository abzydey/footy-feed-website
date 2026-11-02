---
name: prisma-migrate-direct-url
description: Prisma migrations run via schema directUrl = DIRECT_DATABASE_URL (Neon direct host); migrating through the -pooler URL strands the advisory lock (P1002)
metadata:
  node_type: memory
  type: feedback
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-05T07:20:33.901Z
---

Since 2026-10-05, `schema.prisma` has `directUrl = env("DIRECT_DATABASE_URL")`, set on Railway and in local `apps/api/.env` to the direct (non-pooler) Neon `fullset-sg` host. Plain `npx prisma migrate deploy` now does the right thing, locally and in Railway's pre-deploy step.

**Why:** on 2026-10-04 and 05 migrations failed with P1002 because Prisma migrate run through the pgbouncer pooler (including Railway's own pre-deploy migrate) left its session advisory lock (objid 72707369) on an idle pooled connection, blocking every later migration.

**How to apply:** if P1002 ever reappears, check `select pid, objid, application_name from pg_locks join pg_stat_activity using(pid) where locktype='advisory'` and `pg_terminate_backend(pid)` the idle holder, then retry. If the database moves again, update both DATABASE_URL (pooler) and DIRECT_DATABASE_URL (direct) on Railway and locally. See [[db-singapore-move]].
