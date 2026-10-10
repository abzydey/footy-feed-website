import { useEffect } from "react";

const SITE_NAME = "Full Set";
// The one public address — fullset.au redirects here (Vercel's primary
// domain is www), so canonical/og URLs point straight at it.
export const SITE_URL = "https://www.fullset.au";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export interface DocumentMetaOptions {
  /** Rendered as "{title} | Full Set" — pass the page-specific part only. */
  title: string;
  description: string;
  /** Path only, e.g. "/teams/broncos" — combined with SITE_URL. Defaults to the current path. */
  path?: string;
  image?: string;
  type?: "website" | "article";
  /** Keep this page out of search results (not-found states, admin, search results, personal feeds). */
  noindex?: boolean;
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="canonical"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Sets document.title plus Open Graph/Twitter Card meta tags per route. Note
// this only helps clients that execute JS — regular search crawlers
// (Googlebot) and the browser tab/history UI, but NOT most social/messaging
// link-preview bots (Facebook, Twitter/X, Slack, iMessage, WhatsApp), which
// read the static HTML response only and never run JavaScript. Full social-
// preview support for dynamic routes (a specific team or game) would need
// server-side rendering or a bot-specific edge function — out of scope here;
// see README's SEO notes.
//
// Also sets the canonical URL (path, or the current path) and the robots
// tag. middleware.ts writes the same tags into the HTML itself for the main
// page types, so crawlers that don't run JS see them too.
export function useDocumentMeta({ title, description, path, image, type = "website", noindex = false }: DocumentMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    const ogImage = image ?? DEFAULT_OG_IMAGE;

    document.title = fullTitle;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
    setCanonical(url);

    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", ogImage);
    setMeta("property", "og:locale", "en_AU");

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);
  }, [title, description, path, image, type, noindex]);
}

// Injects a schema.org JSON-LD script tag, replacing any previous one this
// hook added. Used for SportsEvent structured data on game pages.
export function useJsonLd(data: object | null) {
  useEffect(() => {
    if (!data) return;
    // middleware.ts already wrote this page's data into the HTML; replace
    // it rather than declare the same thing twice.
    document.getElementById("ssr-jsonld")?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [data]);
}
