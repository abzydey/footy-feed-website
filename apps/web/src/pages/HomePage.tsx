import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Team } from "../lib/api";
import GeneralNewsFollow from "../components/GeneralNewsFollow";

export default function HomePage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listTeams().then(setTeams).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <GeneralNewsFollow />
      <h1 className="text-xl font-bold text-white">Teams</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!teams && !error && <p className="text-slate-400 text-sm">Loading…</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {teams?.map((team) => (
          <Link
            key={team.id}
            to={`/teams/${team.slug}`}
            className="rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 p-4 text-center"
          >
            <span className="font-medium text-white">{team.shortName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
