---
name: team-list-screenshot-cropping-risk
description: "Don't infer a player was omitted from a 24hr/Final team-list update just because they're absent from a screenshot — the screenshot may be a partial/scrolled crop"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-09-03T11:48:35.505Z
---

When diffing a 24hr or Final team-list screenshot against the INITIAL roster to figure out who's been omitted, a player's name missing from the screenshot is not reliable evidence they were actually dropped — the screenshot may simply be scrolled/cropped and not show the full interchange/reserves list.

**Why:** in the same session, this caused two real errors in one batch — Sebastian Su'a (Dolphins) and Arama Hau (Titans) were both listed as "omitted" in a 24hr update based on their absence from a cropped screenshot, when both were actually still in the squad. The user had to catch and correct both after the fact.

**How to apply:** only mark a player as omitted when there's positive evidence — either explicit text confirming it ("Omitted — X, Y" from the source), or a screenshot/list that's visibly the complete interchange+reserves section (not cut off top or bottom). If a screenshot might be partial, say so and ask for confirmation of the full list rather than inferring omissions from what's merely not visible. See [[team_list_strikethrough_format]] for the separate phrasing requirement once the actual omitted names are confirmed correct.
