import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { api, EventItem, Player, Team } from "../lib/api";
import EventCard from "../components/EventCard";
import FollowButton from "../components/FollowButton";

export default function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<{
    team: Team;
    players: Player[];
    latestLineupChange: EventItem | null;
    recentEvents: EventItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setData(null);
    api.getTeamBrief(slug).then(setData).catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <p className="p-4 text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="p-4 text-slate-400 text-sm">Loading…</p>;

  const { team, players, latestLineupChange, recentEvents } = data;
  // Contextual per-team accent (falls back to the brand color when a team
  // has no primaryColor set yet) — used only for decorative touches, never
  // for chrome like the follow button, which always stays brand violet.
  const accent = team.primaryColor ?? "#6927F4";

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: accent }} />
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display font-black text-3xl tracking-tight text-white">{team.name}</h1>
          <FollowButton targetType="TEAM" targetId={team.id} />
        </div>
      </div>

      {latestLineupChange && (
        <section>
          <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wide mb-2">
            Latest lineup change
          </h2>
          <EventCard event={latestLineupChange} />
        </section>
      )}

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wide mb-2">Recent news</h2>
        <div className="space-y-3">
          {recentEvents.length === 0 && <p className="text-slate-500 text-sm">No updates yet.</p>}
          {recentEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* Phase 1: no standalone player pages — status + follow live right here. */}
      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wide mb-2">Squad</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {players.map((player) => (
            <div
              key={player.id}
              className="rounded-lg border border-t-2 border-slate-800/80 bg-slate-900 px-3 py-2 space-y-1.5 shadow-md shadow-black/20"
              style={{ borderTopColor: accent }}
            >
              <div className="text-white text-sm font-bold">{player.name}</div>
              <div className="text-xs text-slate-500">{player.position ?? "—"}</div>
              <StatusBadge status={player.currentStatus} />
              {player.currentStatusNote && (
                <p className="text-xs text-slate-400">{player.currentStatusNote}</p>
              )}
              <FollowButton targetType="PLAYER" targetId={player.id} label="Follow" compact />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    AVAILABLE: "text-emerald-400",
    QUESTIONABLE: "text-amber-400",
    OUT: "text-red-400",
    INJURED: "text-red-400",
    SUSPENDED: "text-red-400",
    UNKNOWN: "text-slate-500",
  };
  return <span className={`text-xs font-medium ${colors[status] ?? "text-slate-500"}`}>{status}</span>;
}
