---
name: theme-tokens-both-modes
description: "Web app has dark (default) + light themes via CSS variables; new UI must use theme tokens, never hardcoded neutral hex."
metadata:
  node_type: memory
  type: project
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-09T01:53:42.437Z
---

Since 2026-10-09 the web app has an Appearance switch (Dark default, Light, Match my phone), stored per device in localStorage "fs-theme". Tailwind's white/slate/surface/app/brand-violet read CSS vars from index.css; `text-white` means "foreground" (navy in light mode).

**Why:** user wanted dark kept as default after "too dark" feedback, with light opt-in for viewers.

**How to apply:** in new components use text-white, white/opacity, slate-*, bg-surface*, bg-app, brand-violet — no hardcoded neutral hex (#04091B, #1C2440 etc.); for inline styles use `rgb(var(--c-...))`. Light-coloured artwork needs `force-dark` or a navy backing. Screenshot both themes (shoot.cjs supports `"theme":"light"`) when changing UI.
