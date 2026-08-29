/**
 * Turns a pasted YouTube URL (watch/short/share/embed form) into an
 * embeddable `youtube.com/embed/<id>` URL for an iframe. Returns null if the
 * URL isn't recognized as YouTube, so callers can fall back to a plain link.
 */
export function getYouTubeEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parsed.pathname.slice(1);
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (parsed.pathname.startsWith("/embed/")) {
      videoId = parsed.pathname.slice("/embed/".length);
    } else if (parsed.pathname.startsWith("/shorts/")) {
      videoId = parsed.pathname.slice("/shorts/".length);
    }
  }

  if (!videoId) return null;
  videoId = videoId.split("&")[0].split("?")[0];
  return `https://www.youtube.com/embed/${videoId}`;
}
