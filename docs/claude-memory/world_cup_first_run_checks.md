---
name: world-cup-first-run-checks
description: "Men's RLWC 2026 sync was built before any lists/scores existed — verify player-field and score-field parsing on first real data (~13–15 Oct 2026)"
metadata:
  node_type: memory
  type: project
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-13T05:21:36.603Z
---

The men's Rugby League World Cup sync (apps/api/src/lib/worldCupPoller.ts, worldCupTeamLists.ts) was built on 2026-10-04 from rlwc2026.com pages that had no team lists or scores yet, so one thing is an educated guess:
- player record fields in each game page's `initialTeamList` sections (reads name/fullName/firstName+lastName, number/jerseyNumber, position/positionName)

It raises an admin push alert instead of failing silently.

**Verified 2026-10-13:** Round 1 lists parsed correctly for all 10 nations (names, numbers, bench, reserves). The poller is hourly in a game week, so lists can lag up to an hour behind the site — on 13 Oct only AUS v NZL had been picked up, and a manual `syncWorldCupTeamLists()` run filled the rest. Verified 2026-10-16: AUS v NZL score synced live (24-22, FULL_TIME); 24-hour updates published on time; final lists now wait for a real change or the last hour (site shows "Confirmed" all week). All first-run checks done. Live scores were moved (2026-10-05) to NRL.com competition 131 draw data (same format as NRL games; all 18 fixtures matched by kickoff time) — no guesswork there, and no X/Twitter dependency.

**Why:** the user chose to automate World Cup team lists like the NRL's; first real test is Round 1 lists (likely ~Tue 13 Oct) and the first result (Australia v New Zealand, 15 Oct).

**How to apply:** when the user next talks to me after ~13 Oct, check Railway logs for `[worldCupTeamLists]`/`[worldCupPoller]` and the /world-cup/20261310110 page; after 15 Oct confirm the score synced from NRL.com. World Cup team lists never push notifications (user's choice, option A). Men's only. Related: [[db-singapore-move]].

After the final (15 Nov 2026): set WORLD_CUP_IN_MENU=false in apps/web/src/lib/season.ts to drop the phone World Cup tab (added 2026-10-09).
