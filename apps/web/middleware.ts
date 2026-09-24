import { next } from "@vercel/edge";

// Vercel Edge Middleware runs before vercel.json's rewrites (which send
// every other path to /index.html for the Vite SPA to handle client-side —
// see vercel.json). That's fine for a real visitor: React Router mounts,
// NewsArticlePage fetches the article, and useDocumentMeta (see
// lib/useDocumentMeta.ts) updates the tab title/meta tags after the fact.
// It's NOT fine for a link-preview bot (X, Slack, iMessage, Facebook, ...):
// those fetch the raw HTML once and never execute JS, so they'd only ever
// see index.html's static, generic meta tags — every original article
// would preview identically instead of with its own headline/summary. This
// intercepts just those bots' requests to /news/:slug and serves them a
// small server-rendered HTML document with the real per-article tags
// filled in; everyone and everything else (real users, Googlebot, which
// does execute JS) passes straight through untouched via next().
export const config = {
  matcher: "/news/:slug*",
};

// Deliberately name-matching, not exhaustive fingerprinting — these are the
// crawlers that actually matter for link previews. A bot not on this list
// just falls through to the normal SPA, same as any real browser; the
// downside is a slightly worse preview from an obscure bot, not a broken
// page, so a loose allowlist is the right trade-off over a brittle one.
const PREVIEW_BOT_UA = /facebookexternalhit|twitterbot|slackbot|telegrambot|whatsapp|discordbot|linkedinbot|pinterest|redditbot|skypeuripreview|embedly|quora link preview|outbrain|vkshare|applebot|flipboard|nuzzel/i;

const SITE_URL = "https://fullset.au";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
// Same API the SPA itself talks to (see lib/api.ts) — this runs on
// Vercel's edge, not in the browser, so it's a server-to-server call, not
// subject to the browser CORS policy CORS_ORIGIN configures for.
const API_URL = "https://footy-feedapi-production.up.railway.app/api";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderPreviewHtml(article: { headline: string; body: string }, pageUrl: string): string {
  const title = escapeHtml(`${article.headline} | Full Set`);
  const description = escapeHtml(article.body);
  const url = escapeHtml(pageUrl);

  // No app shell, no JS — a bot never renders this visually, it only reads
  // the <head> tags. A real browser should never actually see this (the
  // UA check above only matches known non-executing bots), but the visible
  // link is there anyway so a bot that DOES render + a stray direct hit
  // still lands somewhere real instead of a blank page.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:site_name" content="Full Set" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
</head>
<body><a href="${url}">${title}</a></body>
</html>`;
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!PREVIEW_BOT_UA.test(userAgent)) {
    return next();
  }

  const url = new URL(request.url);
  const slug = url.pathname.replace(/^\/news\//, "").replace(/\/$/, "");
  if (!slug) return next();

  try {
    const apiRes = await fetch(`${API_URL}/articles/${encodeURIComponent(slug)}`);
    if (!apiRes.ok) return next(); // includes a genuine 404 — let the SPA show its own not-found state
    const article: { headline: string; body: string } = await apiRes.json();

    return new Response(renderPreviewHtml(article, url.toString()), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    // Network hiccup talking to the API — fall through to the normal SPA
    // rather than show the bot an error page.
    return next();
  }
}
