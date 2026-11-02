---
name: injury-ingestion-no-auto-news
description: "Bulk/automated injury data imports must only update Player.currentStatus, never create Event rows — News items for injuries stay a manual, deliberate action."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-09-07T03:31:30.817Z
---

When ingesting injury data in bulk (e.g. scraping NRL.com's casualty ward or
any similar batch source), only update `Player.currentStatus` /
`currentStatusNote` / `statusUpdatedAt` — do not also create an `Event` row
(type `INJURY`) for each one.

**Why:** The first time this was built, a bulk casualty-ward import created
both the Player status update *and* an INJURY-type Event per player. Events
are timestamped `createdAt: now()`, so a season-ending injury from months
earlier showed up on the team page's news list looking like it happened "1h
ago" — the bulk-import time, not the real injury date. This was flagged as
misleading and all ~76 auto-generated INJURY events from that import were
deleted after the fact, while the Player.currentStatus data (the actual
"Injury list" section on team pages) was kept and is the correct source of
truth for current injury status.

**How to apply:** A *single, deliberate* injury update prompted by a real
news article (the normal screenshot/paste → Claude Code workflow, one
player at a time) is fine to enter as a proper INJURY Event via
`POST /api/admin/events` with `newStatus` set — that's exactly what the
Player.currentStatus auto-sync in `routes/events.ts` is for, and it's
appropriately timestamped since it's real same-day news. The rule is
specifically about *bulk/batch* imports of pre-existing, already-old status
data: those should write directly to `Player.currentStatus` only (a plain
Prisma update, no Event), never spawn a wave of fake "new" news items with
today's timestamp. See also [[signings_general_news_rule]] for the parallel
GENERAL_NEWS-copy rule, which is the opposite situation (deliberately want a
second row) — don't confuse the two.
