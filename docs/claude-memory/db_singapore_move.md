---
name: db-singapore-move
description: "Live DB is Neon project fullset-sg (Singapore) since 2026-10-01; old us-east-2 project deleted 2026-10-15"
metadata:
  node_type: memory
  type: project
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-14T13:09:55.661Z
---

On 2026-10-01 the API (Railway, asia-southeast1) and database (Neon project `fullset-sg`, ap-southeast-1, host `ep-green-truth-b3h31ka0`) moved from us-east to Singapore. The old us-east-2 Neon project ("Full Set App", host `ep-dark-morning-ax3ekuiy`) was deleted by the user on 2026-10-15 and its commented URL removed from `apps/api/.env`.

**Why:** users are in Australia; us-east added a trans-Pacific round trip to every request.

**How to apply:** fullset-sg is the only database. If anything references `ep-dark-morning`, it's stale.
