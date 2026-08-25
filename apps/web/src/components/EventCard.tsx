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
    <article className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
        <span className="uppercase tracking-wide font-semibold text-emerald-400">
          {TYPE_LABEL[event.type] ?? event.type}
        </span>
        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      </div>
      <h3 className="font-semibold text-white">{event.headline}</h3>
      <p className="text-slate-300 text-sm mt-1">{event.body}</p>
      {event.player && <p className="text-xs text-slate-500 mt-2">Re: {event.player.name}</p>}
      {event.sourceUrl && (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-400 hover:underline mt-2 inline-block"
        >
          Source →
        </a>
      )}
    </article>
  );
}
