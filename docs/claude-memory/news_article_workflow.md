---
name: news-article-workflow
description: Standing workflow for turning a pasted NRL article/screenshot into a published Full Set News item — no tweet draft
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-09-09T04:37:53.037Z
---

When the user pastes an NRL article (text or screenshot) into chat, run the full workflow automatically, without being asked: write an app summary (no quotes, avoid heavy figure-stacks, strictly from the source), determine Category and team tag(s), extract the byline, and publish the app summary directly to Full Set's News section. No tweet draft — see the correction below.

**Why:** confirmed 2026-09-02 as a standing instruction, explicitly meant to not need restating each time. The user asked for a durable written reference specifically so this survives a fresh session.

**Correction (2026-09-09):** the original version of this workflow also generated a tweet draft for @NRLCentral on every article. The user corrected this — tweet drafts are team-list (Late Mail) territory only, not plain articles. `CONTRIBUTING-news.md` has been updated to match; don't reintroduce the tweet-draft step for articles. Never auto-post to X either way.

**How to apply:** full rules (category logic, team tagging, byline format, source-link mismatch handling) are written out in `CONTRIBUTING-news.md` at the repo root — read that file when this task comes up rather than relying on memory alone, since it's the maintained source of truth. See [[signings_general_news_rule]] for the Category duplication rule specifically.
