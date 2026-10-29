# Full Set — working notes for Claude

Full Set (fullset.au) is an NRL news, team-list and scores app for fans:
every club's news, official team lists, injuries, signings, scores and the
men's Rugby League World Cup in one place. The owner sends news and requests
in chat (often from their phone) and expects them published straight away.
These notes carry over everything learned in earlier sessions. Read
`CONTRIBUTING-news.md` too — it is the maintained rulebook for news.

## Where everything lives

| What | Where |
| --- | --- |
| Code | GitHub `abzydey/footy-feed-website`, branch `main` (push here; never force-push) |
| API + every background job | Railway, Singapore. Project `1fa8c9ca-2ad8-484c-b958-c9e1ca91b8d8`, service `ac31e72e-e5b6-4db9-868d-116bf806cb7f`. Deploys on push to `main` |
| Website | Vercel project `footy-feed-website-web`, root `apps/web`, primary domain **www.fullset.au** (fullset.au redirects). Deploys on push |
| Database | Neon project `fullset-sg` (Singapore). The only database — the old us-east one was deleted 2026-10-15 |
| iOS/Android apps | Capacitor shells in `apps/web/ios` and `apps/web/android`, built on Codemagic (`codemagic.yaml`). Web changes reach the apps only after a Codemagic build |
| Push notifications | Firebase project `footy-feed-281c9` |
| Search | Google Search Console (Domain property fullset.au), sitemap `https://www.fullset.au/sitemap.xml` |
| Session log (continuity record) | https://claude.ai/artifact/Jnp56yzuxDPNYWnsYijDLS |
| Design system for Claude Design | https://claude.ai/artifact/RHhNAGfrXuuYK4PKqUSDKj |
| Post Maker (social posts) | https://claude.ai/artifact/Jny48jAg7azC8JxrGq1ncX — source `brand/post-maker/` |

Monorepo: `apps/api` (Express + Prisma on Postgres) and `apps/web` (Vite +
React + Tailwind). Secrets are in `apps/api/.env` / `apps/web/.env*` locally
(gitignored) or the cloud environment's variables — never commit them, never
print their values.

Everything automatic runs on Railway on its own: NRL team lists (Late Mail
poller), live NRL scores (NRL.com match centre), World Cup fixtures/scores/
team lists, the X social feed, podcast/highlights polling. Nothing needs a
laptop to be on.

## Running scripts

From `apps/api`: `npx tsx scripts/<name>.ts <file.json>`. Write the JSON to a
temp file first (avoids shell-quoting problems with apostrophes).

- `addNews.ts` — publish a news story. Fields: `headline`, `summary`,
  `source`, `author`, `link`, `team` (Team slug), `type` (`TRANSFER` for a
  Signings copy; default GENERAL_NEWS), `worldCup: true`, `articleBody`
  (makes it a Full Set original at /news/:slug), `media` (photos: put the
  file in `apps/web/public/news/`, push, then
  `[{ "url": "https://www.fullset.au/news/x.jpg", "width": .., "height": .. }]`).
  One run = one row for one club; run it once per tagged club. It notifies
  that club's followers.
- `addTransfer.ts` — signings tracker entry: `[{ player, kind: SIGNED |
  RE_SIGNED | RELEASED | RETIRED, from, to, until, headline }]`.
- `setFreeAgents.ts` — the free agency list at /free-agents (players off
  contract at the end of 2027): add players, set `tier`, `linked` clubs
  (from our own stories only), `freeAgentNow`. Players are crossed off
  automatically by `addTransfer.ts` entries (matched by name; deals ending
  before 2028 don't count) — never cross anyone off by hand.
- `setWorldCupSquad.ts` — a nation's World Cup squad.
- `setLateMailUrl.ts <url>` — pin the weekly NRL.com team-list article.
- `bulkImportInjuries.ts` — status-only injury import (never creates news).

Team slugs: broncos, bulldogs, cowboys, dolphins, dragons, eels, knights,
panthers, rabbitohs, raiders, roosters, sea-eagles, sharks, storm, titans,
warriors, wests-tigers, perth-bears ("Bears"), png-chiefs ("Chiefs").

**Database connection can drop mid-script** (seen repeatedly). A run can save
the story and then fail on notifications. Before retrying, check the live
feed so nothing is posted twice:
`curl -s "https://footy-feedapi-production.up.railway.app/api/feed?limit=80"`
and look for the headline + team slug. Retry only the missing copies.

Editing a published story: update the existing rows (all club copies,
`prisma.event.updateMany({ where: { headline } })`) — don't republish; that
would duplicate it and notify followers again. Adding a club later: copy the
first row with the new `teamId` and the original `createdAt` (keeps its place
in the feed, no notification).

## News workflow (the most common request)

When the owner pastes a summary/article (text or screenshots), publish it
straight away — no confirmation step, no tweet draft.

- **Category: General NRL News** → one GENERAL_NEWS row per tagged club
  (none = league-wide, no `team`).
- **Category: Signings** (a confirmed deal) → for each tagged club a
  TRANSFER row AND a GENERAL_NEWS row, plus one `addTransfer.ts` entry per
  player (`until` only when stated). "Set to", "close to", "in talks",
  "on the verge" stories are General News only — never the tracker. Coaches
  and staff don't go in the tracker.
- **World Cup stories** get `worldCup: true` as well as club tags. A story
  that only mentions the World Cup in passing doesn't.
- **Byline** → `author`; outlet → `source` (CODE Sports, Sydney Morning
  Herald, ESPN, the club, etc.). A podcast/radio source has no link.
- **Headline**: write a clear sentence-case one if none is given. Facts
  only from the source; never invent a reason, figure or contract length.
- **Links**: "[add link]" means none yet — publish without, add it later
  with `updateMany({ sourceUrl })`. CODE Sports columns ("Sport
  Confidential", "Sunday Sesh", "Market Watch") bundle several stories under
  one URL — a slug about a different story is normal for those. If a link
  clearly doesn't match the story, publish without it and ask.
- When the owner sends their own summary for a story already published, swap
  the summary into the existing rows rather than posting again.
- Free agency: when a story links an available free agent with a club
  ("in talks", "tabled an offer"), add that club to his `linked` list with
  setFreeAgents.ts. A club pulling its offer → `freeAgentNow: true`.
- Flag (don't silently change) anything odd: a tag that isn't in the story,
  a figure that contradicts an earlier story, a deal reported as confirmed
  that earlier reports said was only offered.

## Team lists

- NRL: when the owner sends the weekly NRL.com team-list link (usually
  Tuesday), run `setLateMailUrl.ts <url>` immediately. The poller reads that
  page all week (Initial → 24-hour → Final).
- Omitted players must be written exactly `Omitted from the NN — Name, Name.`
  (em dash) or the strikethrough on the Initial list won't render.
- Final updates: full numbered grid `1. Name, ... 13. Name. Bench: 14. ...`
  then the Omitted sentence. Players keep their own jersey number when
  moving position. Never write "remains in the reserves mix"; write
  "<Name> remains the one reserve as the <Team> trim their squad ahead of
  <Day>'s clash with the <Opponent>."
- Positions by number: 1 fullback, 2/5 wing, 3/4 centre, 6 five-eighth,
  7 halfback, 8/10 prop, 9 hooker, 11/12 second row, 13 lock; 14+ bench.
- Never treat a player as omitted just because they're missing from a
  possibly-cropped screenshot.
- Late Mail by chat: parse and show results; publish only after approval.

## Men's Rugby League World Cup 2026 (until the final, 15 Nov 2026)

- Fixtures from rlwc2026.com; scores, live clock and try scorers from each
  game's NRL.com match centre (competition 131). Team lists from each game's
  rlwc2026.com page, same three stages as the NRL, six-man bench (14–19)
  picked by jersey number. No push notifications for World Cup lists.
- NRL.com's weekly World Cup team-list article is a cross-check only — do
  not pin it with setLateMailUrl.
- Squads live in `WorldCupSquad`; for an injury replacement remove the
  player, add the replacement with club, and extend the `note`.
- 7Sport's men's highlights are added to the Highlights page automatically.
- After the final: set `WORLD_CUP_IN_MENU = false` in
  `apps/web/src/lib/season.ts`.

## Brand

- The logo files in `brand/` are the source of truth — use them as-is, never
  retype the wordmark or invent a mark. Exports in `brand/generated/`
  (social avatars, X banner, app icons, og image).
- Colours: navy #0B1533 (cards #142048), Full Set Purple #A855F7 (hover
  #AE6BFF), Siren #FF6B2C only for live/breaking/OUT. Fonts: Saira (display,
  italic 900) and Archivo (body; headlines bold 700, not extra-bold).
- If site colours or fonts change, update the design system artifact too.
- Post Maker: edit `brand/post-maker/template.html`, build with
  `node brand/post-maker/build.cjs <out.html>`, republish to its URL.

## Web app conventions

- Dark theme is the default; light mode and "Match my phone" are opt-in
  (top-bar sun/moon + Appearance switch). Colours come from CSS variables:
  use `text-white`, `text-slate-*`, `bg-surface*`, `bg-app`, `brand-violet`
  — never hardcoded neutral hex. Check new UI in both themes.
- New page? Add it to `apps/web/middleware.ts` (STATIC_META or a pattern)
  too, or search engines are told it doesn't exist.
- Season switches in `apps/web/src/lib/season.ts` (IN_SEASON,
  FINALS_IN_MENU, WORLD_CUP_IN_MENU).

## Database changes

- Migrations: `npx prisma migrate deploy` (uses `DIRECT_DATABASE_URL`, the
  non-pooler host). Table names are snake_case (`events`,
  `world_cup_matches`…) — check `@@map` before writing SQL.
- If a migration fails with P1002 (stuck advisory lock), find the holder in
  `pg_locks` and `pg_terminate_backend` it, then retry.

## Habits

- Commit and push after each meaningful change; end commit messages with
  the co-author line the session asks for.
- Typecheck before pushing: `npx tsc --noEmit -p apps/web` and `-p apps/api`.
- Write to the owner in plain language: what was published, under which
  clubs, and anything they need to decide. Keep it short.
- Bulk injury imports update player status only — never create news rows.
