---
name: tuesday-team-list-link
description: "When the user sends the weekly NRL.com team-list link (usually Tuesday), pin it immediately with scripts/setLateMailUrl.ts — it's the source for that week's Initial/24hr/Final updates."
metadata:
  node_type: memory
  type: feedback
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-09-25T02:50:21.273Z
---

When the user sends the NRL.com team-list link for the round (typically Tuesday), run
`npx tsx scripts/setLateMailUrl.ts <url>` from apps/api straight away — don't just publish the Initial lists by hand and move on.

**Why:** NRL.com live-updates that one page all week (Initial → 24hr → Final) and uses a fresh link every week. In the 2026 Preliminary Finals round the user sent the link, I published Initials manually and said "I'll keep using that URL", but never pointed the poller at it — it silently read last week's article all week and the 24hr update for Dolphins v Roosters never went out. User had to flag it ("I specifically said that on the Tuesday").

**How to apply:** the script validates the page, stores the pin in the DB (AppSetting `lateMail.pinnedUrl`, survives redeploys), and runs a poll immediately. Check its output — any "didn't match a game" warning means the fixture needs creating first. The poller prefers the pin over its own nrl.com/news/ discovery and logs a `STALE:` error if no candidate covers the upcoming games. Related: [[late-mail-chat-workflow]], [[team-list-strikethrough-format]].
