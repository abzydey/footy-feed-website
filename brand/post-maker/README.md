# Full Set Post Maker

Published at https://claude.ai/artifact/Jny48jAg7azC8JxrGq1ncX — add a photo, pick
Breaking / Signing / Team news / Result, type the headline, save the Instagram
post (1080×1350), Instagram story (1080×1920) and X post (1600×900).

`template.html` is the source; build the page with `node brand/post-maker/build.cjs <out.html>`, which fills three placeholders:
`__FS_MARK__` and `__LOCKUP__` with `brand/fullset-lockup.svg` and `brand/fullset-header-lockup.svg` as base64 data URIs, and
`__CLUBS__` with `clubs.json` (each club's badge colours, from
`apps/web/src/lib/teamBadge.ts` `teamColors`). The layouts follow the
templates designed in Claude Design from the Full Set design system.
