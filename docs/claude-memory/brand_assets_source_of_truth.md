---
name: brand-assets-source-of-truth
description: "The brand files Claude produced (repo brand/ folder + Full Set design system artifact) are the official Full Set brand; use them, never redraw or approximate the logo."
metadata:
  node_type: memory
  type: project
  originSessionId: ed9366bb-ff6e-4cc2-81f8-a5f13ac6d045
  modified: 2026-10-14T13:22:09.526Z
---

The user confirmed (2026-10-15) that the logo and brand assets Claude adjusted are the source of truth for Full Set:
- Vector masters in the repo at `brand/` (fullset-header-lockup.svg, fullset-lockup.svg, fullset-appicon.svg, favicon.svg) and exports in `brand/generated/` (app icons, favicons, header lockups, social avatars, og image, splash); web copies in `apps/web/public/brand/` (incl. fullset-header-lockup-light.svg, navy wordmark for light mode).
- The Post Maker (social posts from photo + text): https://claude.ai/artifact/Jny48jAg7azC8JxrGq1ncX, source in `brand/post-maker/`.
- The Full Set design system artifact for Claude Design: https://claude.ai/artifact/RHhNAGfrXuuYK4PKqUSDKj (logos, social images, tokens, brand book; cover shows the real header lockup).
- Brand colours: Full Set Purple #A855F7 (hover #AE6BFF), Siren #FF6B2C for urgency only, navy ground #0B1533 (cards #142048). Fonts: Saira (display, italic 900) + Archivo (body, headlines bold 700).

**Why:** an earlier design-system cover typed "Full Set" in a font with abstract shapes and the user said it "looks nothing like my logo".

**How to apply:** whenever a logo, graphic, social image or brand page is needed, use these files as-is — never retype the wordmark or invent a mark. When site colours/fonts change, update the design system too so Claude Design stays in step. Related: [[theme-tokens-both-modes]].
