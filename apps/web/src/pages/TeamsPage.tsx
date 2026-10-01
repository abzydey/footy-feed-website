import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Team } from "../lib/api";
import TeamBadge from "../components/TeamBadge";
import PageHero from "../components/ui/PageHero";
import { TileGridSkeleton } from "../components/ui/Skeleton";
import { teamColors } from "../lib/teamBadge";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "All NRL Teams",
    description: "Every NRL club — team lists, injuries, news, and ladder position, all in one place.",
    path: "/teams",
  });

  useEffect(() => {
    api.listTeams().then(setTeams).catch((err) => setError(err.message));
  }, []);

  // Each club as a tappable tile with its badge and a thin stripe in its
  // colours — recognisable at a glance, the way a sports app lists teams.
  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 lg:px-5 space-y-5">
      <PageHero title="Teams" subtitle="Tap a club for its news, team list and injuries." />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!teams && !error && <TileGridSkeleton count={9} />}
      {teams && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.slug}`}
              className="rounded-[18px] overflow-hidden bg-surface border border-white/[.07] hover:border-brand-violet/45 transition-colors duration-150"
            >
              <div className="flex h-1" aria-hidden="true">
                {teamColors(team).map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: c }} />
                ))}
              </div>
              <div className="flex items-center gap-3 px-3.5 py-3.5">
                <TeamBadge team={team} size="md" />
                <span className="min-w-0 flex flex-col">
                  <span className="font-extrabold text-[15px] text-white truncate">{team.shortName}</span>
                  <span className="text-[11.5px] text-slate-500 truncate">{team.name}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
