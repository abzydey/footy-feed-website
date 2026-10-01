import { TweetMedia } from "../lib/api";

// A social post's photos/videos, under the text like on X itself. Videos
// load nothing but the poster frame until tapped (preload="none") so a
// scroll through Social doesn't pull every clip. playsInline keeps iOS from
// forcing fullscreen the moment one starts; GIFs autoplay muted on loop, the
// way X shows them.
export default function TweetMediaView({ media }: { media: TweetMedia[] }) {
  const photos = media.filter((m) => m.type === "photo");
  const clip = media.find((m) => m.type !== "photo");

  if (clip) {
    const ratio = clip.width && clip.height ? `${clip.width} / ${clip.height}` : "16 / 9";
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-white/[.08] bg-black">
        {clip.type === "animated_gif" ? (
          <video src={clip.url} poster={clip.previewUrl ?? undefined} autoPlay muted loop playsInline className="block w-full max-h-[520px] object-contain" style={{ aspectRatio: ratio }} />
        ) : (
          <video src={clip.url} poster={clip.previewUrl ?? undefined} controls playsInline preload="none" className="block w-full max-h-[520px] object-contain" style={{ aspectRatio: ratio }} />
        )}
      </div>
    );
  }

  if (!photos.length) return null;
  const one = photos.length === 1;
  return (
    <div className={`mt-2 overflow-hidden rounded-xl border border-white/[.08] grid gap-0.5 ${one ? "" : "grid-cols-2"}`}>
      {photos.slice(0, 4).map((p) => (
        <img
          key={p.url}
          src={p.url}
          alt=""
          loading="lazy"
          className={`block w-full object-cover bg-white/[.04] ${one ? "max-h-[520px]" : "aspect-square"} ${photos.length === 3 && p === photos[0] ? "row-span-2 h-full" : ""}`}
        />
      ))}
    </div>
  );
}
