import { EventItem } from "../lib/api";

const TYPE_LABEL: Record<string, string> = {
  INJURY: "Injury update",
  LINEUP_CHANGE: "Lineup change",
  NEWS: "News",
  TRANSFER: "Transfer",
  GENERAL_NEWS: "General NRL news",
};

export default function EventCard({ event }: { event: EventItem }) {
  return (
    <article className="rounded-xl border border-slate-800/80 bg-slate-900 p-4 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
        <span className="uppercase tracking-wide font-bold text-brand-heliotrope">
          {TYPE_LABEL[event.type] ?? event.type}
        </span>
        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      </div>
      <h3 className="font-display font-extrabold text-lg text-white tracking-tight">{event.headline}</h3>
      <p className="text-slate-300 text-sm mt-1">{event.body}</p>
      {event.player && <p className="text-xs text-slate-500 mt-2">Re: {event.player.name}</p>}
      {event.sourceUrl && (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-heliotrope hover:underline mt-2 inline-block"
        >
          Source →
        </a>
      )}
    </article>
  );
}
