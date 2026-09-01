/**
 * Extracts the video ID from a pasted YouTube URL (watch/short/share/embed
 * form). Returns null if the URL isn't recognized as YouTube.
 */
export function getYouTubeVideoId(url: string): string | null {
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
  return videoId.split("&")[0].split("?")[0];
}

/** Turns a pasted YouTube URL into an embeddable `youtube.com/embed/<id>` URL for an iframe. */
export function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

// Highest quality first (1280x720 — matches a 16:9 card exactly, no
// upscaling blur) down to the one size YouTube generates for every video
// regardless of upload quality — a caller should try these in order via
// onError, since maxresdefault.jpg doesn't exist for older/lower-res
// uploads (YouTube serves a small grey placeholder instead of erroring, so
// this can't be detected from the URL alone).
export const YOUTUBE_THUMBNAIL_QUALITIES = ["maxresdefault", "sddefault", "hqdefault"] as const;

/** Turns a pasted YouTube URL into its free thumbnail image URL — no API key, no iframe. */
export function getYouTubeThumbnailUrl(
  url: string,
  quality: (typeof YOUTUBE_THUMBNAIL_QUALITIES)[number] = "maxresdefault"
): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/${quality}.jpg` : null;
}
