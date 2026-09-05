import { useEffect, useMemo, useState } from "react";

import { api, EventItem, Team } from "../lib/api";
import EventCard from "../components/EventCard";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// Same pill style as Home's chip row (HomePage.tsx CHIPS) — "All" plus one
// per team, filtering by the post's own tagged team (post.team.id). A
// SOCIAL_POST can optionally carry a teamId like any other event (see
// schema.prisma design notes), so a post with no team tag at all (general
// league chatter) only ever shows under "All", not under any specific club.
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

export default function SocialPage() {
  const [posts, setPosts] = useState<EventItem[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL Social",
    description: "The best NRL reactions and chatter from X, all in one feed.",
    path: "/social",
  });

  useEffect(() => {
    api.listSocialPosts().then(setPosts).catch((err) => setError(err.message));
    api.listTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  const filtered = useMemo(
    () => (selectedTeamId ? posts?.filter((p) => p.team?.id === selectedTeamId) : posts),
    [posts, selectedTeamId]
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Social</h1>

      {teams.length > 0 && <TeamChips teams={teams} selectedId={selectedTeamId} onSelect={setSelectedTeamId} />}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!posts && !error && <FeedSkeleton count={5} />}
      {filtered && filtered.length === 0 && (
        <p className="text-slate-500 text-sm">{selectedTeamId ? "No posts for this team yet." : "No posts yet."}</p>
      )}
      <div>
        {filtered?.map((post) => (
          <EventCard key={post.id} event={post} />
        ))}
      </div>
    </div>
  );
}
