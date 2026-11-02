---
name: push-regularly
description: "User wants git commits pushed to GitHub regularly, not left as a large uncommitted backlog"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-08-29T06:04:19.152Z
---

Push to the existing GitHub repo (github.com/abzydey/footy-feed-website, `main` branch) regularly — after each significant round of changes — rather than letting work accumulate uncommitted.

**Why:** Discovered on 2026-08-29 that an entire extended session's worth of work (game results feature, Team Lists page, podcast/social poller backend, ladder round-in-progress, brand assets, ~98 files) had never been committed or pushed — only synced through Aug 26. The user's stated goal is protecting against local-machine data loss ("back up before something happens to my laptop"), so a big uncommitted backlog defeats that purpose.

**How to apply:** After completing a meaningful chunk of work in a session (a feature, a batch of fixes, a round of data entry that touches code), proactively stage, commit with a clear message, and push — don't wait to be asked. Use plain `git push` to `origin main` (no force push). If this is ever in doubt, err toward pushing sooner rather than accumulating more unpushed work. See also [[db-hosting-migration]] for the parallel effort of getting the actual database data off local-only storage too.
