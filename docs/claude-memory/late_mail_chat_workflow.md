---
name: late-mail-chat-workflow
description: User can trigger NRL.com Late Mail fetch/parse from chat instead of the admin panel UI — show results here, publish only after approval
metadata:
  node_type: memory
  type: feedback
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-09-04T08:41:56.292Z
---

When the user says something like "run Late Mail for this round" or pastes a Late Mail URL, hit `POST /api/admin/late-mail/parse` myself (same local-dev-server admin-token-minting pattern used for every other admin task this session — mint a JWT with `ADMIN_JWT_SECRET`, POST to `localhost:4000`, never production directly) and show the parsed results in chat: each match, each side's matched team, suggested stage, and any `shapeWarnings` — rather than telling the user to open the admin panel's Late Mail tab themselves.

**Why:** explicit standing request — "Can I trigger the Late Mail fetch/parse via a Claude Code command instead of opening the admin panel UI?... you hit the backend endpoint, and show me the parsed results... right here in chat — then I still go publish manually in the admin panel, or tell you to hit a publish endpoint once I've reviewed and approved it in chat." Same underlying principle as the earlier "Cant i jusy tell u do these things why do i have to go admin portal" correction — the admin panel UI is a fallback for the user, not something I should route them to when I can just do the API call myself.

**How to apply:**
1. Parse-and-show is always safe to do proactively without asking — it writes nothing (`routes/adminLateMail.ts`'s `/parse` has no side effects).
2. Publishing an individual team's parsed list is a separate, explicit step — only do it after the user reviews the chat output and approves (either a specific team, or "publish all of these"). Never auto-publish straight from a parse.
3. To publish, reuse the exact same `POST`/`PATCH /api/admin/events` calls (via a temp script, same as every other team-list entry this session) — mint a token, check whether an event already exists for that game+team+stage (PATCH it) or not (POST a new one), matching `LateMailForm.tsx`'s own upsert logic so a re-run later in the week updates in place rather than duplicating.
4. The generated body text from the parse response is already in the correct structured format (`1. Name, ... Bench: ... Omitted from the NN — ...`) — publish it as-is unless the user asks for a correction, same as every other team-list body this session.

See [[team_list_strikethrough_format]] for the body-formatting conventions this reuses (full-grid style, changed-player highlighting, banned phrases, the FINAL-update tweet requirement).
