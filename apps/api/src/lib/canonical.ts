import { prisma } from "./prisma";

// One story can exist as several Event rows — one per club tag (and a
// signing's TRANSFER + GENERAL_NEWS pair) — each with its own /story/:id,
// and an original article's copies each get their own /news/:slug (-2, -3,
// ...). To search engines those are duplicate pages, so every copy names
// one canonical URL: the earliest-created row of the story. Same grouping
// as the web app's dedupeStories (headline + sourceUrl).
export async function canonicalPathFor(event: {
  headline: string;
  sourceUrl: string | null;
}): Promise<string> {
  const first = await prisma.event.findFirst({
    where: {
      type: { in: ["GENERAL_NEWS", "TRANSFER"] },
      headline: event.headline,
      sourceUrl: event.sourceUrl,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, isOriginalArticle: true, slug: true },
  });
  if (!first) return "/news";
  return first.isOriginalArticle && first.slug ? `/news/${first.slug}` : `/story/${first.id}`;
}
