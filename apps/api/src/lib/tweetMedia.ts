import type { MediaObjectV2, TweetV2 } from "twitter-api-v2";

// A tweet's photos/videos in the shape stored on Event.media (see
// schema.prisma) and rendered by EventCard.tsx's social card.
export interface TweetMediaItem {
  type: "photo" | "video" | "animated_gif";
  url: string; // the image for a photo; the best MP4 for a video/GIF
  previewUrl: string | null; // a video's poster frame
  width: number | null;
  height: number | null;
}

// Fields every timeline/lookup request needs so the two helpers below have
// something to work with — spread into the request params.
export const TWEET_MEDIA_PARAMS: { "media.fields": (keyof MediaObjectV2)[] } = {
  "media.fields": ["type", "url", "preview_image_url", "variants", "width", "height"],
};

// Resolves a tweet's attachments.media_keys against the response's
// includes.media. Videos and GIFs come back as several variants (an HLS
// playlist plus MP4s at different bitrates) — picks the highest-bitrate
// MP4, which plays in a plain <video> everywhere incl. iOS.
export function extractTweetMedia(tweet: TweetV2, includesMedia: MediaObjectV2[] | undefined): TweetMediaItem[] {
  const keys = tweet.attachments?.media_keys ?? [];
  const items: TweetMediaItem[] = [];
  for (const key of keys) {
    const m = includesMedia?.find((x) => x.media_key === key);
    if (!m) continue;
    if (m.type === "photo" && m.url) {
      items.push({ type: "photo", url: m.url, previewUrl: null, width: m.width ?? null, height: m.height ?? null });
    } else if (m.type === "video" || m.type === "animated_gif") {
      const mp4 = (m.variants ?? [])
        .filter((v) => v.content_type === "video/mp4")
        .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0];
      if (!mp4) continue;
      items.push({
        type: m.type,
        url: mp4.url,
        previewUrl: m.preview_image_url ?? null,
        width: m.width ?? null,
        height: m.height ?? null,
      });
    }
  }
  return items;
}

// X appends a t.co link to the text of any tweet with media — that link
// just points back at the photo/video itself, so once the media is shown on
// the card it's noise. entities.urls marks those with a media_key.
export function stripMediaLinks(text: string, tweet: TweetV2): string {
  let out = text;
  for (const u of tweet.entities?.urls ?? []) {
    if ((u as { media_key?: string }).media_key) out = out.split(u.url).join("");
  }
  return out.trim();
}
