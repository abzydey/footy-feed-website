import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Team } from "../lib/api";
import { TileGridSkeleton } from "../components/ui/Skeleton";

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTeams().then(setTeams).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Teams</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!teams && !error && <TileGridSkeleton count={9} />}
      {teams && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              to={`/teams/${team.slug}`}
              className="rounded-xl bg-surface border border-white/10 shadow-card hover:border-white/20 hover:bg-surface-hover transition-all duration-150 active:scale-[0.98] p-4 text-center"
            >
              <span className="font-display font-extrabold text-lg tracking-tight text-white">
                {team.shortName}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
