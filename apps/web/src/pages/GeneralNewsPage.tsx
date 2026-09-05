import { useEffect, useMemo, useState } from "react";

import { api, EventItem, Team } from "../lib/api";
import { GENERAL_NEWS_TARGET_ID } from "../lib/constants";
import EventCard from "../components/EventCard";
import FollowButton from "../components/FollowButton";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// Same pill style as Home's chip row (HomePage.tsx CHIPS) — "All" plus one
// per team, filtering by the event's own tagged team (item.team.id), not a
// text/headline match. A GENERAL_NEWS story can carry a real teamId (see
// schema.prisma design notes — a signing tagged to two clubs is two Event
// rows, each with its own teamId), so this is a precise filter, not a guess.
function TeamChips({
  teams,
  selectedId,
  onSelect,
}: {
  teams: Team[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {[{ id: null, shortName: "All" }, ...teams].map((t) => {
        const active = selectedId === t.id;
        return (
          <button
            key={t.id ?? "all"}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`shrink-0 font-sans text-[12.5px] font-bold tracking-[.02em] px-3.5 py-2 rounded-full whitespace-nowrap transition-colors duration-150 border ${
              active
                ? "bg-brand-violet text-white border-transparent"
                : "bg-white/[.04] text-white/60 border-white/[.14] hover:text-white"
            }`}
          >
            {t.shortName}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The dedicated page for the "NRL News" follow target (LEAGUE) —
 * same pattern as a team or game page: its own header with a Follow button,
 * and its own list of related content. Reuses GET /api/feed (no separate
 * endpoint needed) but filters down to GENERAL_NEWS only — that endpoint
 * also carries TRANSFER events for Home's "Signing News" chip (see
 * routes/feed.ts), which don't belong on a page explicitly described as
 * "not tied to one team."
 */
export default function GeneralNewsPage() {
  const [items, setItems] = useState<EventItem[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL News",
    description: "Breaking league-wide NRL stories, not tied to one club.",
    path: "/news",
  });

  useEffect(() => {
    api
      .getFeed()
      .then((feed) => setItems(feed.filter((e) => e.type === "GENERAL_NEWS")))
      .catch((err) => setError(err.message));
    api.listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const filtered = useMemo(
    () => (selectedTeamId ? items?.filter((i) => i.team?.id === selectedTeamId) : items),
    [items, selectedTeamId]
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <PageHero title="NRL News" subtitle="Breaking league-wide stories, not tied to one team.">
        <FollowButton targetType="LEAGUE" targetId={GENERAL_NEWS_TARGET_ID} />
      </PageHero>

      {teams.length > 0 && <TeamChips teams={teams} selectedId={selectedTeamId} onSelect={setSelectedTeamId} />}

      <section>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!items && !error && <FeedSkeleton count={4} />}
        {filtered && filtered.length === 0 && (
          <p className="text-slate-500 text-sm">
            {selectedTeamId ? "No news for this team yet." : "No news yet."}
          </p>
        )}
        <div>
          {filtered?.map((item) => (
            <EventCard key={item.id} event={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
