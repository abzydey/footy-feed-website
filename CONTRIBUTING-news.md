# Contributing NRL news to Full Set

How a pasted NRL article (text or screenshot) becomes a published Full Set
News item. This is the standing workflow — apply it automatically when an
article is pasted into chat, without needing it restated.

## The workflow

1. Read the source article.
2. Write the app summary — see "App summary" below.
3. Determine Category — see "Category" below.
4. Determine team tag(s) — see "Team tagging" below.
5. Extract the byline — see "Byline" below.
6. Publish the app summary directly to Full Set's News section (category,
   team tag(s), byline, and source link included).

No tweet draft for a plain article — that's team-list (Late Mail) territory
only, not this workflow. Never auto-post to X regardless.

## App summary

No direct quotes, avoid heavy stacks of figures. Stick strictly to the
source — never fabricate names, stats, or details not present in it.

## Category

- Default: **General NRL News**.
- Use **Signings** only for a confirmed signing, re-signing, or contract
  extension — not rumours or unconfirmed reports.
- Standing rule: every Signings item also gets a matching General NRL News
  copy (same headline/body/source, tagged to the same team(s)) so it also
  shows on the dedicated News page. Not vice versa — a plain General NRL
  News item never needs a Signings copy.

## Team tagging

Tag every team genuinely relevant to the story. A player leaving one club
for another gets both clubs tagged — two Event rows, since an Event only
carries one team each.

## Byline

Format as `By: [Name], [Publication]`. Use the publication alone (no
personal byline) if the article doesn't credit an individual writer, or if
a source has asked not to be named on a given story.

## Source link

If a supplied source URL looks mismatched to the article's actual content,
flag it rather than publishing with a wrong link — publish without a
`sourceUrl` and ask for the correct one instead of guessing.

Before flagging, though: some source articles are wrap-up columns (e.g.
Code Sports' "Sport Confidential") that bundle several unrelated stories
under one URL/headline — the page's own title won't match every item inside
it, and that's normal, not a wrong link. A mismatch is worth flagging when
the *content* pasted genuinely isn't found on that page at all, not just
because the URL's slug/title describes a different item in the same
column.

## Original articles

Everything above is the link-out workflow: a summary of someone else's
reporting, with a "Read more" pointing back to their site. A Full Set
original article is different — a full piece we've written ourselves,
published in-app at `/news/[slug]` instead of linking anywhere.

Use this when the user pastes a full headline + body (not just a summary of
an external article) and says it's an original/Full Set piece, rather than
a pasted news article to summarize.

1. Category is still **General NRL News** (or **Signings** if it's reporting
   a confirmed signing) — an original article isn't its own category, it's
   the same GENERAL_NEWS content with `isOriginalArticle: true` set (see
   schema.prisma's design note on the `Event` model).
2. There's still a short feed-card summary (equivalent to "App summary"
   above) — that's what shows on Home/News before someone taps in. It's
   separate from the article body, which is the full markdown piece.
3. Byline is always **Full Set** — there's no external outlet to credit,
   since this is a piece we wrote. No source name/URL/author fields.
4. The slug is derived from the headline automatically (see
   `uniqueArticleSlug` in `apps/api/src/routes/events.ts` /
   `apps/api/scripts/addNews.ts`) — a collision just appends `-2`, `-3`, etc.
5. Publish via `scripts/addNews.ts` with an `articleBody` field set (markdown:
   `## heading`s and paragraphs, `*italic*`/`**bold**` inline) — its presence
   is what marks the Event as an original article; everything else
   (headline/summary/team tag) works exactly like a normal News item.
6. Verify facts against real sources before publishing (as normal for any
   News item) — note this explicitly in the source material handed over,
   even though it won't appear as a visible citation on the published page.
