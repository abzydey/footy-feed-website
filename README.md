# Full Set — Phase 1

The data engine + fan brief: team status pages, a game-by-game fixture view,
a clean general-news home feed, a separate Social destination for
tweet-style posts, follow-based push alerts (per-team, per-player, and
league-wide), timestamped podcast search, and a Podcasts browse page. This is
the lean v1 to put in front of an existing NRL audience and see if people
actually use it, before investing in scraping automation or a native app.

## Phase 1 scope

**In scope:** one brief page per NRL team (injury/availability status per
player, most recent lineup change, recent news); a Games directory + a page
per fixture (team lists, late changes, and news tied to that match, linking
back to both teams' pages); a home page feed of general NRL news only; a
separate Social section — a site-wide `/social` page plus a Social section on
every team and game page — for tweet-style posts scoped to that surface;
follow alerts for a team, an individual player, or the league-wide "General
NRL News" category; a manual admin panel that feeds all of the above;
timestamped podcast search over 1-2 transcribed shows; and a separate
Podcasts browse page listing episodes with embedded YouTube links.

**Explicitly out of scope for Phase 1:** standalone player brief pages (player
status/news shows inline on their team's page instead — see below), odds/
betting data, influencer content, clip-sourcing, automated fixture
scraping (games are entered manually via the admin panel, same as
everything else), and YouTube-API auto-detection for podcast episodes
(the admin pastes a link + title/description by hand). None of this is
designed against for later — it's just not being built now.

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
full-set/
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

Railway's per-service build/start commands reference the npm workspace name
directly (e.g. `npm run build --workspace=@full-set/api`) — if the workspace
package name in `apps/api/package.json` / `apps/web/package.json` ever
changes (e.g. a project rename), update those commands in the Railway
dashboard too, or the build fails with `No workspaces found`.

**There are two Railway projects on this account** (`grand-quietude` and
`selfless-respect`), both containing a service literally named
`@footy-feed/api` — a leftover from troubleshooting the workspace-rename
issue above. Only `grand-quietude`'s `@footy-feed/api` is real: it's the one
with a custom domain proxied from `fullset.au`/`www.fullset.au` (via Vercel)
and it's the one whose `DATABASE_URL` points at the shared Neon database.
`selfless-respect` is a stray duplicate with no domain wired to anything
public — don't apply fixes there by mistake; always confirm the project ID
(`1fa8c9ca-2ad8-484c-b958-c9e1ca91b8d8` for `grand-quietude`) before changing
Railway settings.

## Data model (`apps/api/prisma/schema.prisma`)

- **Team**, **Player** — reference data. `Player.currentStatus` /
  `currentStatusNote` / `statusUpdatedAt` are a denormalized cache of "the
  latest injury update for this player," kept in sync by the event-creation
  endpoint so the team page doesn't have to recompute it on every read.
- **Game** — an upcoming fixture: two teams, a kickoff time, and a round
  (free text, e.g. "Round 14" or "Grand Final" — not every round is
  numbered). Sits alongside Team/Player as its own reference-ish entity, not
  inside the Event system, and its page is a new, separate browsable surface
  that links back to team pages rather than replacing them.
- **Event** — the single content table behind team pages, game pages, the
  home feed, the Social section, and alerts. Every admin panel entry
  (injury update, lineup change, news blurb, transfer, general league news,
  or a tweet-style social post) is one row, typed via `EventType`.
  Team/player events link to a `teamId` and/or `playerId`; any event can
  additionally link to a `gameId` to tie it to a specific match (a lineup
  change, a late change, or match-day news). `GENERAL_NEWS` and
  `SOCIAL_POST` events can skip all three — they're league-wide/feed-only by
  definition, though a `SOCIAL_POST` can optionally carry a `teamId`/`gameId`
  too. The home feed (`GET /api/feed`) queries `GENERAL_NEWS` events only —
  a clean news feed, not a mixed one. `SOCIAL_POST` events get their own
  separate Social destination instead: `GET /api/social` for every post
  app-wide, plus a `socialPosts` array (filtered by `teamId`/`gameId`) on the
  team and game detail responses for a Social section on each page.
  Team-specific types are excluded from both the home feed and the Social
  views — they already have a home on their team/game page's main event
  list. New Events are what triggers the alert fan-out. Keeping one content
  table instead of splitting into separate tables per category is what keeps
  v1 easy to extend — `SOCIAL_POST` is a new `EventType`, not a new table,
  for the same reason `GENERAL_NEWS` isn't one.
- **Subscriber**, **Follow** — no fan login in v1. A Subscriber is identified
  by its FCM token (one per browser). Follow is polymorphic
  (`targetType` + `targetId`), with three target types: `TEAM`, `PLAYER`, and
  `LEAGUE`. Following a team, a player, and opting into "General NRL News" all
  share one table and one notification fan-out query. `LEAGUE` has no real row
  to point at, so its `targetId` is always the same fixed constant
  (`GENERAL_NEWS_TARGET_ID`, defined in both apps' `lib/constants.ts` — keep
  those two files in sync if it ever changes). There's no `GAME` follow
  target: an event tied to a game notifies that game's two teams' existing
  followers (falling back to both sides when no specific team/player was
  picked) rather than introducing a separate "follow this game" subscription.
- **NotificationLog** — records every push attempt, so a subscriber is never
  double-notified for the same event and the admin panel can show delivery
  counts later.
- **AdminUser** — a handful of internal accounts for the admin panel, separate
  from the fan-facing Subscriber model.
- **Podcast**, **Episode**, **TranscriptSegment** — back the podcast search
  feature. `Episode.audioUrl` also backs the separate Podcasts browse page:
  it's reused as-is for a manually pasted YouTube URL rather than adding a
  second URL column, since it's already just "the URL to play this episode
  from" regardless of whether that's an RSS audio enclosure or a YouTube
  link.

Full details and the reasoning behind each choice are commented directly in
the schema file — read that before changing it.

## Local setup

```bash
npm install                     # installs apps/api + apps/web
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

docker compose up -d            # local Postgres on :5432

npm run db:migrate              # creates tables from schema.prisma
npm run db:seed                 # seeds all 17 NRL teams, a sample admin user,
                                 # one real upcoming game + update, sample
                                 # social posts (untargeted, team-tied, and
                                 # game-tied), and a sample podcast episode

npm run dev:api                 # http://localhost:4000
npm run dev:web                 # http://localhost:5173
```

The seed script prints a default admin login (`admin@example.com` /
`change-me-now`) — change that password before this goes anywhere public.

## What's already wired up vs. stubbed

**Working end-to-end:** a home page feed (`GET /api/feed`) of `GENERAL_NEWS`
events only, newest-first; a separate Social section — `/social`
(`GET /api/social`, every post app-wide) plus a Social block on each team
page and game page (scoped to that team's/game's own posts) — rendering
`SOCIAL_POST` events as compact tweet-style cards; a Teams directory → team
brief page (roster with per-player status, latest lineup change, recent
news); a Games directory → per-game page (latest team list/late change,
full match history, links back to both teams); a Podcasts browse page
listing episodes with embedded YouTube players (`GET /api/podcasts/episodes`),
separate from podcast search; admin login with three forms — "publish an
update" (writes an Event, including `GENERAL_NEWS`/`SOCIAL_POST`, which skip
the team/player selects entirely, and an optional game link; injury events
also update the player's cached status), "create a game", and "add an
episode" (paste a YouTube link + title/description); a "General NRL News"
follow toggle alongside per-team and per-player follows; podcast search API
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
- Automated fixture scraping/ingestion to populate Games, replacing manual
  admin entry (Games launched manual-only deliberately, to validate the
  page/notification flow on a real fixture before automating a full round).
- Automated scraping/ingestion to replace manual admin entry for news/events.
- YouTube-API auto-detection for the Podcasts browse page (pull title/
  thumbnail/description from a pasted link automatically, instead of typing
  them by hand).
- Whisper-based transcription pipeline running on a schedule per podcast RSS feed.
- Native app wrapper, if web push + PWA installability isn't enough on iOS.
