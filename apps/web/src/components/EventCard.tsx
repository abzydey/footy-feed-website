import { useState } from "react";
import { Link } from "react-router-dom";

import { EventItem } from "../lib/api";
import { STAGE_BADGE_CLASS, STAGE_LABEL } from "../lib/teamListStage";

const TYPE_LABEL: Record<string, string> = {
  INJURY: "Injury update",
  LINEUP_CHANGE: "Lineup change",
  NEWS: "News",
  TRANSFER: "Transfer",
  GENERAL_NEWS: "NRL news",
  SOCIAL_POST: "Social post",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// "Full Set Wire" -> "FS", "The Sideline" -> "TS", "Daily Telegraph" -> "DT",
// single word -> its first two letters. Matches the design handoff's source
// monogram convention (16px rounded chip next to the source name).
function monogramFor(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FF";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const ChevronRight = () => (
  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="shrink-0">
    <path d="M1 4.5h8M6 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A real circular profile photo for the handle, via unavatar.io (a free,
// unauthenticated avatar proxy — X's oEmbed response doesn't include a
// profile-image URL, and we're not on paid X API tiers). Falls back to an
// initial-in-a-circle only if unavatar has nothing cached for that handle.
function TweetAvatar({ handle }: { handle: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="h-9 w-9 shrink-0 rounded-full bg-brand-violet/20 border border-brand-violet/50 flex items-center justify-center text-brand-heliotrope font-display font-extrabold text-xs">
        {handle.slice(0, 1).toUpperCase() || "#"}
      </div>
    );
  }

  return (
    <img
      src={`https://unavatar.io/twitter/${handle}`}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-9 w-9 shrink-0 rounded-full object-cover bg-[#1C2440]"
      onError={() => setFailed(true)}
    />
  );
}

interface EventCardProps {
  event: EventItem;
  /** Slightly smaller headline/summary scale (17/13 vs 18.5/13.5) — used on
   * the Team page's news section per the design handoff's per-screen type table. */
  compact?: boolean;
}

export default function EventCard({ event, compact = false }: EventCardProps) {
  const gameLink = event.game && (
    <Link
      to={`/games/${event.game.id}`}
      className="text-xs text-slate-500 hover:text-white transition-colors duration-150 block mt-1"
    >
      Re: {event.game.homeTeam.shortName} vs {event.game.awayTeam.shortName} · {event.game.round}
    </Link>
  );

  // Tweet-style card — same data, different shape, so a mixed feed visually
  // reads as "news" vs. "social chatter" the way a team news app does. Our
  // own card (not X's real embed widget — see TweetAvatar above for why),
  // built to a fixed reference: real avatar, "Name @handle · time" header
  // row, plain body text, plain-text "View on X" link. No engagement counts
  // (we don't have real ones) or extra actions like a separate copy-link.
  if (event.type === "SOCIAL_POST") {
    const handle = event.headline.replace(/^@/, "");
    return (
      <article className="bg-surface border border-white/[.07] rounded-[14px] px-[15px] py-[13px] mb-3 last:mb-0 hover:border-brand-violet/45 transition-colors duration-150">
        <div className="flex items-start gap-2.5">
          <TweetAvatar handle={handle} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 text-sm min-w-0">
              {event.sourceAuthor && <span className="font-bold text-white truncate">{event.sourceAuthor}</span>}
              <span className="text-slate-500 truncate">@{handle}</span>
              <span className="text-slate-600 shrink-0">·</span>
              <time dateTime={event.createdAt} className="text-slate-500 shrink-0">
                {timeAgo(event.createdAt)}
              </time>
            </div>
            <p className="text-slate-200 text-[13.5px] leading-relaxed mt-1">{event.body}</p>
            {gameLink}
            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand-heliotrope hover:text-white transition-colors duration-150 mt-1.5 inline-block"
              >
                View on X
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  // Kicker: the content-category label (top-left, accent, e.g. "GENERAL
  // NRL NEWS" / "TRANSFER"). Source: who published it — for GENERAL_NEWS
  // that's the linked-out outlet (+ journalist when credited); for
  // Full-Set-authored types (INJURY/LINEUP_CHANGE/NEWS/TRANSFER) it's
  // "Full Set" unless an explicit source was given. These are two
  // different things the old single "byline" conflated.
  const kicker = (TYPE_LABEL[event.type] ?? event.type).toUpperCase();
  const source =
    event.sourceAuthor && event.sourceName
      ? `${event.sourceAuthor} · ${event.sourceName}`
      : event.sourceName ?? "Full Set";
  const monogram = monogramFor(event.sourceName ?? "Full Set");

  return (
    <article className="bg-surface border border-white/[.07] rounded-[14px] px-[15px] pt-[15px] pb-[13px] mb-3 last:mb-0 hover:border-brand-violet/45 transition-colors duration-150">
      <div className="flex items-center gap-2 mb-[9px]">
        <span className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">{kicker}</span>
        <span className="w-[3px] h-[3px] rounded-full bg-white/25 shrink-0" />
        <span className="text-[11px] font-semibold text-white/38">{timeAgo(event.createdAt)}</span>
      </div>
      {event.type === "LINEUP_CHANGE" && event.teamListStage && (
        <span
          className={`inline-block text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 mb-1.5 ${STAGE_BADGE_CLASS[event.teamListStage]}`}
        >
          {event.teamListStage === "FINAL" && "🚨 "}
          {STAGE_LABEL[event.teamListStage]}
        </span>
      )}
      <h3
        className={`font-extrabold text-white tracking-[-.018em] [text-wrap:pretty] ${
          compact ? "text-[17px] leading-[1.2]" : "text-[18.5px] leading-[1.18]"
        }`}
      >
        {event.headline}
      </h3>
      <p
        className={`text-white/56 leading-[1.48] mt-[7px] [text-wrap:pretty] ${compact ? "text-[13px]" : "text-[13.5px]"}`}
      >
        {event.body}
      </p>
      {event.player && <p className="text-xs text-slate-500 mt-2">Re: {event.player.name}</p>}
      {gameLink}
      <div className="flex items-center justify-between mt-[13px] pt-3 border-t border-white/[.06]">
        <div className="flex items-center gap-[7px] min-w-0">
          <span className="shrink-0 w-4 h-4 rounded-[4px] bg-[#1C2440] flex items-center justify-center text-[8.5px] font-extrabold text-white/60">
            {monogram}
          </span>
          <span className="text-[11.5px] font-semibold text-white/46 truncate">{source}</span>
        </div>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 flex items-center gap-[5px] text-xs font-extrabold tracking-[.02em] text-brand-violet hover:text-white transition-colors duration-150"
          >
            Read more <ChevronRight />
          </a>
        )}
      </div>
    </article>
  );
}
