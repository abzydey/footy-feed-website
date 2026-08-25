# Footy Feed — Phase 1

The data engine + fan brief: team status pages, follow-based push alerts
(per-team, per-player, and league-wide), and timestamped podcast search. This
is the lean v1 to put in front of an existing NRL audience and see if people
actually use it, before investing in scraping automation or a native app.

## Phase 1 scope

**In scope:** one brief page per NRL team (injury/availability status per
player, most recent lineup change, recent news); follow alerts for a team, an
individual player, or the league-wide "General NRL News" category; a manual
admin panel that feeds both; timestamped podcast search over 1-2 transcribed
shows.

**Explicitly out of scope for Phase 1:** standalone player brief pages (player
status/news shows inline on their team's page instead — see below), odds/
betting data, influencer content, and clip-sourcing. None of this is designed
against for later — it's just not being built now.

**A note on player pages:** the original brief included a dedicated page per
player. That's deferred — team pages are the only browsable page in v1. The
underlying data isn't cut, though: `Player.currentStatus` and per-player
Events still exist and render inline in a team page's squad list (status
badge, note, and a follow button per player), because injury status is
inherently player-level information. What's gone is the separate `/teams/
:team/players/:player` URL and page — add that back in a later phase if the
team-only version proves the concept.

## Structure

```
footy-feed/
  apps/
    api/    Express + TypeScript + Prisma (Postgres). All reads/writes, admin auth,
            follow fan-out, podcast search.
    web/    React + Vite + TypeScript + Tailwind. Responsive — same codebase
            serves laptop and phone browsers, no native app.
  docker-compose.yml   Local Postgres for development.
```

Both apps are npm workspaces under one repo (`npm install` at the root installs
both). Deploy them separately — `apps/api` to Railway (needs a persistent
Postgres + a long-running Node process), `apps/web` to Vercel (static build).

## Data model (`apps/api/prisma/schema.prisma`)

- **Team**, **Player** — reference data. `Player.currentStatus` /
  `currentStatusNote` / `statusUpdatedAt` are a denormalized cache of "the
  latest injury update for this player," kept in sync by the event-creation
  endpoint so the team page doesn't have to recompute it on every read.
- **Event** — the single content table behind both the team page and alerts.
  Every admin panel entry (injury update, lineup change, news blurb, transfer,
  or general league news) is one row, typed via `EventType`. Team/player
  events link to a `teamId` and/or `playerId`; a `GENERAL_NEWS` event links to
  neither — it's league-wide by definition. The team page queries Events
  directly; new Events are what triggers the alert fan-out. Keeping one
  content table instead of splitting into separate tables per category (or
  building a separate system for general news) is what keeps v1 easy to
  extend.
- **Subscriber**, **Follow** — no fan login in v1. A Subscriber is identified
  by its FCM token (one per browser). Follow is polymorphic
  (`targetType` + `targetId`), with three target types: `TEAM`, `PLAYER`, and
  `LEAGUE`. Following a team, a player, and opting into "General NRL News" all
  share one table and one notification fan-out query. `LEAGUE` has no real row
  to point at, so its `targetId` is always the same fixed constant
  (`GENERAL_NEWS_TARGET_ID`, defined in both apps' `lib/constants.ts` — keep
  those two files in sync if it ever changes).
- **NotificationLog** — records every push attempt, so a subscriber is never
  double-notified for the same event and the admin panel can show delivery
  counts later.
- **AdminUser** — a handful of internal accounts for the admin panel, separate
  from the fan-facing Subscriber model.
- **Podcast**, **Episode**, **TranscriptSegment** — back the podcast search
  feature.

Full details and the reasoning behind each choice are commented directly in
the schema file — read that before changing it.

## Local setup

```bash
npm install                     # installs apps/api + apps/web
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

docker compose up -d            # local Postgres on :5432

npm run db:migrate              # creates tables from schema.prisma
npm run db:seed                 # seeds all 17 NRL teams + a sample admin user

npm run dev:api                 # http://localhost:4000
npm run dev:web                 # http://localhost:5173
```

The seed script prints a default admin login (`admin@example.com` /
`change-me-now`) — change that password before this goes anywhere public.

## What's already wired up vs. stubbed

**Working end-to-end:** team directory → team brief page (roster with
per-player status, latest lineup change, recent news); admin login +
"publish an update" form that writes an Event — including the `GENERAL_NEWS`
category, which skips the team/player selects entirely — and (for injuries)
updates the player's cached status; a "General NRL News" follow toggle on the
home page alongside per-team and per-player follows; podcast search API
(simple `ILIKE` scan — fine for 1-2 podcasts' worth of transcripts).

**Stubbed, ready to wire up next:**

- **Alerts delivery.** `apps/api/src/lib/notify.ts` already resolves "which
  subscribers should hear about this Event" — team/player followers, or
  `LEAGUE` followers for `GENERAL_NEWS` — whenever an Event is created, and
  logs what it *would* send. Wiring in `firebase-admin`'s
  `messaging.sendEach(...)` in place of the `console.log` is the remaining
  step — needs a Firebase project (see below).
- **Push permission UI.** `apps/web/src/lib/push.ts` and the Follow button
  request notification permission and register an FCM token, but need a real
  Firebase project's config in `apps/web/.env` to do anything. Until then,
  `isFirebaseConfigured` is `false` and follow attempts fail gracefully with
  an explanatory message instead of erroring.
- **Podcast transcription.** No transcription pipeline yet — `Episode` and
  `TranscriptSegment` rows need to be populated by a script that pulls an RSS
  feed, downloads audio, and calls the Whisper API. That's a natural next
  piece to build (a small script or scheduled job in `apps/api`, not a new
  service).
- **Full text search.** `/api/search` does a plain substring match. Once
  there's real transcript volume, add a raw SQL migration for a
  `search_vector tsvector` generated column + GIN index on
  `transcript_segments`, and swap the Prisma `contains` filter for
  `to_tsquery`.

## Alerts: Firebase setup (when you're ready to wire this in)

1. Create a Firebase project (free tier is enough for web push).
2. Project Settings → Cloud Messaging → generate a Web Push certificate
   (VAPID key) → put it in `apps/web/.env` as `VITE_FIREBASE_VAPID_KEY`.
3. Copy the rest of the web app config into `apps/web/.env`
   (`VITE_FIREBASE_*`), and paste the same values into the placeholders in
   `apps/web/public/firebase-messaging-sw.js`.
4. Project Settings → Service Accounts → generate a private key → put the
   JSON (as one line) in `apps/api/.env` as `FIREBASE_SERVICE_ACCOUNT_JSON`.
5. In `apps/api/src/lib/notify.ts`, initialize `firebase-admin` from that env
   var and replace the `console.log` with a real `messaging.sendEach(...)` call.

iOS Safari only supports web push from 16.4+, and only after the site has
been added to the home screen (a PWA manifest, which isn't in this scaffold
yet — worth adding once alerts are otherwise working, since a chunk of an NRL
audience will be on iPhones).

## Roadmap after v1 validates

- Standalone player brief pages (their own URL, deep-linkable from socials).
- Automated scraping/ingestion to replace manual admin entry.
- Whisper-based transcription pipeline running on a schedule per podcast RSS feed.
- Native app wrapper, if web push + PWA installability isn't enough on iOS.
