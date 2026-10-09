import { Link } from "react-router-dom";

import { EventItem } from "../lib/api";
import { timeAgo } from "../lib/format";
import { teamColors } from "../lib/teamBadge";

// The row's accent bar: the club's brightest colour that still shows on
// navy (a navy primary like the Roosters' would vanish), else Full Set
// Purple for league-wide stories.
function accent(e: EventItem): string {
  const team = e.team;
  if (!team || e.isOriginalArticle || e.worldCup) return "#A855F7";
  const visible = teamColors({ slug: team.slug, primaryColor: team.primaryColor ?? null }).find((c) => luminance(c) > 0.12);
  return visible ?? "#A855F7";
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// What a headline is filed under: World Cup, Signings, its club, or plain
// NRL News for a league-wide story. Full Set originals are league-wide
// pieces even when tagged to every club, so they read as NRL News.
function kicker(e: EventItem): string {
  if (e.worldCup) return "World Cup";
  if (e.isOriginalArticle) return "NRL News";
  if (e.type === "TRANSFER") return "Signings";
  return e.team?.name ?? "NRL News";
}

// Where tapping a headline goes: a Full Set original opens its article page,
// anything else the in-app story page (summary plus the link to the source).
const hrefFor = (e: EventItem) => (e.isOriginalArticle && e.slug ? `/news/${e.slug}` : `/story/${e.id}`);

// A compact, scannable list of the latest headlines — kicker and time on one
// line, the headline under it. Lets Home show many stories in the space a
// couple of full cards would take; the full cards live on the News page.
// `pinned` (optional) is shown first, with a PINNED label.
export default function HeadlineList({ items, pinned }: { items: EventItem[]; pinned?: EventItem | null }) {
  const rows = pinned ? [pinned, ...items.filter((e) => e.headline !== pinned.headline)] : items;
  return (
    <ol className="rounded-[18px] bg-surface border border-white/[.07] px-4">
      {rows.map((e, i) => (
        <li key={e.id} className={i > 0 ? "border-t border-white/[.06]" : ""}>
          <Link to={hrefFor(e)} className="flex gap-3 py-3 group">
            <span className="w-[3px] shrink-0 rounded-full opacity-80 group-hover:opacity-100 transition-opacity duration-150" style={{ background: accent(e) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 flex flex-col gap-1">
              <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[.12em]">
                {pinned && i === 0 && (
                  <span className="flex items-center gap-1 font-display text-brand-violet">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" />
                    </svg>
                    Pinned
                  </span>
                )}
                <span className="font-display text-brand-violet">{kicker(e)}</span>
                <span className="text-slate-500 normal-case tracking-normal font-semibold text-[11.5px]">· {timeAgo(e.createdAt)}</span>
                {e.isOriginalArticle && (
                  <span className="rounded px-1.5 text-[9.5px] text-brand-violet bg-brand-violet/[.12] tracking-wider">Full Set</span>
                )}
              </span>
              <span className="font-extrabold text-[15px] leading-snug text-white group-hover:text-brand-hover transition-colors duration-150">
                {e.headline}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
