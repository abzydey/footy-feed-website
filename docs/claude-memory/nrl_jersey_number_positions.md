---
name: nrl-jersey-number-positions
description: "Standard rugby league jersey number to position mapping (1-13), for writing accurate lineup-change descriptions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 22a1c95f-43fd-457d-aa1a-a1a1538ecb35
  modified: 2026-09-03T08:20:26.694Z
---

Standard NRL/rugby league position numbering: 1 Fullback, 2 & 5 Wing, 3 & 4 Centre, 6 Five-eighth, 7 Halfback, 8 & 10 Prop, 9 Hooker, 11 & 12 Second row, 13 Lock. Interchange (14+) has no fixed position — it's bench order, not a position number.

**Why:** described Brian Pouniu (moved into #12) as shifting "into the centres" when #12 is second row, not centre. The user caught it and asked me to look up the real mapping so it doesn't happen again.

**How to apply:** when describing a lineup change / positional shift in a team-list or squad-update Event body (see [[team_list_strikethrough_format]] for the related "Omitted from..." phrasing rule), name the position using this mapping rather than guessing — e.g. a player moving to #3 or #4 is a centre, #11 or #12 is second row, #13 is lock. Never assume based on gut feel.
