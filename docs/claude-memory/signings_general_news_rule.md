---
name: signings-general-news-rule
description: "Every confirmed Signing gets TRANSFER + GENERAL_NEWS copies AND a tracker entry via addTransfer.ts; not vice versa"
metadata:
  node_type: memory
  type: project
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-10-02T07:43:00.283Z
---

Ongoing rule (confirmed 2026-09-02): every confirmed-signing story (Event type TRANSFER, "Category: Signings") must also have a matching GENERAL_NEWS Event row so it shows on the dedicated General NRL News page — but not every GENERAL_NEWS item needs a TRANSFER copy. The relationship is one-directional.

Added 2026-10-02 (signings tracker at /signings): every confirmed signing ALSO gets one Transfer row per player via `apps/api/scripts/addTransfer.ts`, linked by exact headline. `until` only when the story states the end season. "Set to"/"in talks" stories never go in the tracker.

**Why:** the user initially asked for signings to be tagged "Category: Signings" only, which read as TRANSFER-exclusive — I deleted an existing GENERAL_NEWS duplicate for the Volkman story on that basis. The user then corrected this: signings still need to appear on the General News page too. The tracker needs structured moves (who, from, to, until) that a news Event can't hold.

**How to apply:** for a confirmed signing, without being asked: addNews TRANSFER per tagged team, addNews GENERAL_NEWS copy, then addTransfer for each player. Non-signing General News needs none of this. See [[home-feed-dedupe]] for how the frontend collapses paired rows in merged views.
