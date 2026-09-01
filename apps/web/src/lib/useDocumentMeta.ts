import { useEffect } from "react";

const SITE_NAME = "Full Set";
const SITE_URL = "https://fullset.au";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

export interface DocumentMetaOptions {
  /** Rendered as "{title} | Full Set" — pass the page-specific part only. */
  title: string;
  description: string;
  /** Path only, e.g. "/teams/broncos" — combined with SITE_URL. Defaults to the current path. */
  path?: string;
  image?: string;
  type?: "website" | "article";
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
export function useDocumentMeta({ title, description, path, image, type = "website" }: DocumentMetaOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    const ogImage = image ?? DEFAULT_OG_IMAGE;

    document.title = fullTitle;
    setMeta("name", "description", description);

    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", ogImage);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", ogImage);
  }, [title, description, path, image, type]);
}

// Injects a schema.org JSON-LD script tag, replacing any previous one this
// hook added. Used for SportsEvent structured data on game pages.
export function useJsonLd(data: object | null) {
  useEffect(() => {
    if (!data) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [data]);
}
