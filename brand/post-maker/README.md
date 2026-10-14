# Full Set Post Maker

Published at https://claude.ai/artifact/Jny48jAg7azC8JxrGq1ncX — add a photo, pick
Breaking / Signing / Team news / Result, type the headline, save the Instagram
post (1080×1350), Instagram story (1080×1920) and X post (1600×900).

`template.html` is the source. Before publishing, two placeholders are filled:
`__FS_MARK__` with `brand/fullset-lockup.svg` as a base64 data URI, and
`__CLUBS__` with each club's `{slug, short, colors}` from the app's team badges
(`apps/web/src/lib/teamBadge.ts` `teamColors`). The layouts follow the
templates designed in Claude Design from the Full Set design system.
