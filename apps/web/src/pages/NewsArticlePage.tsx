import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, EventItem } from "../lib/api";
import { renderArticleMarkdown } from "../lib/markdown";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { FeedSkeleton } from "../components/ui/Skeleton";

function formatPublishDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const TYPE_LABEL: Record<string, string> = {
  NEWS: "News",
  GENERAL_NEWS: "General NRL News",
  TRANSFER: "Signings",
};

// The in-app reading page for a Full Set original article (isOriginalArticle:
// true, see schema.prisma) — EventCard.tsx routes "Read more" here instead of
// out to an external sourceUrl for these. useDocumentMeta below covers
// real users' browser tab/history and JS-executing crawlers (Googlebot); it
// deliberately can't cover link-preview bots (X, Slack, iMessage, ...),
// which read raw HTML and never run JS — that's handled server-side by
// apps/web/api/og/[slug].ts, a Vercel Edge Middleware that intercepts just
// those bots' requests to this route (see middleware.ts).
export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<EventItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setArticle(null);
    setNotFound(false);
    api
      .getArticle(slug)
      .then(setArticle)
      .catch(() => setNotFound(true));
  }, [slug]);

  useDocumentMeta({
    title: article?.headline ?? "Article",
    description: article?.body ?? "A Full Set original article.",
    path: slug ? `/news/${slug}` : undefined,
    type: "article",
  });

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto p-4 pt-10 text-center">
        <p className="text-white/60 text-sm">This article doesn't exist, or has been taken down.</p>
        <Link to="/news" className="inline-block mt-3 text-brand-violet font-bold text-sm hover:text-white transition-colors duration-150">
          Back to News
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-2xl mx-auto p-4 pt-6 space-y-4">
        <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
        <div className="h-9 w-full bg-white/10 rounded animate-pulse" />
        <div className="h-9 w-2/3 bg-white/10 rounded animate-pulse" />
        <FeedSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="bg-app">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">
            {TYPE_LABEL[article.type] ?? "News"}
          </span>
          <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
          <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider text-brand-violet border border-brand-violet/40 bg-brand-violet/10 rounded px-1.5 py-[3px]">
            Full Set Original
          </span>
        </div>

        <h1 className="font-display italic font-black text-[28px] sm:text-4xl leading-[1.08] tracking-tight text-white [text-wrap:pretty]">
          {article.headline}
        </h1>

        <div className="flex items-center gap-2 mt-4 text-[13px] text-white/50">
          <span className="font-bold text-white/70">By Full Set</span>
          <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
          <time dateTime={article.createdAt}>{formatPublishDate(article.createdAt)}</time>
        </div>

        {article.team && (
          <Link
            to={`/teams/${article.team.slug}`}
            className="inline-block mt-3 text-xs font-bold text-brand-heliotrope hover:text-white transition-colors duration-150"
          >
            {article.team.name}
          </Link>
        )}

        {/* Comfortable line length on wide screens comes from the shared
            max-w-2xl container above, not a second inner width here — this
            article body is the only thing on the page, so it can just use
            the full container. */}
        <div className="mt-8 border-t border-white/[.08] pt-8">
          {renderArticleMarkdown(article.articleBody ?? "")}
        </div>
      </div>
    </div>
  );
}
