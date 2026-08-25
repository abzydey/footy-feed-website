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
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">Teams</h1>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!teams && !error && <p className="text-slate-400 text-sm">Loading…</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {teams?.map((team) => (
          <Link
            key={team.id}
            to={`/teams/${team.slug}`}
            className="rounded-xl border border-slate-800/80 bg-slate-900 hover:border-brand-violet hover:bg-slate-800/80 transition-colors p-4 text-center shadow-lg shadow-black/20"
          >
            <span className="font-display font-extrabold text-lg tracking-tight text-white">{team.shortName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
