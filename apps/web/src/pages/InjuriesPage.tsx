import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, InjuredPlayer } from "../lib/api";
import { RowListSkeleton } from "../components/ui/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// Same colour convention as TeamPage's per-team injury list (INJURY_COLOR)
// — kept in sync manually, there being no shared component between a
// single-team list and this league-wide one.
const STATUS_COLOR: Record<string, string> = {
  QUESTIONABLE: "text-white/50",
  OUT: "text-brand-siren",
  INJURED: "text-brand-siren",
  SUSPENDED: "text-brand-siren",
};

// League-wide version of the per-team injury list already on TeamPage —
// same Player.currentStatus data, just every club at once instead of one at
// a time. Grouped by team (API returns team-name-then-player-name order
// already), each row showing the free-text note as the "injury/expected
// return" detail — there's no separate structured return-date field, same
// as every other status text in this app (see schema.prisma comment on
// Player.currentStatusNote, e.g. "Hamstring, expected back Rd 15").
export default function InjuriesPage() {
  const [players, setPlayers] = useState<InjuredPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "Injuries",
    description: "Every NRL club's current injury and availability list in one place — player, status, and details.",
    path: "/injuries",
  });

  useEffect(() => {
    api.listInjuries().then(setPlayers).catch((err) => setError(err.message));
  }, []);

  const grouped = (players ?? []).reduce<{ teamId: string; team: InjuredPlayer["team"]; rows: InjuredPlayer[] }[]>(
    (acc, p) => {
      const group = acc.find((g) => g.teamId === p.team.id);
      if (group) group.rows.push(p);
      else acc.push({ teamId: p.team.id, team: p.team, rows: [p] });
      return acc;
    },
    []
  );

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div>
        <h1 className="font-display italic font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">Injuries</h1>
        <p className="text-xs text-slate-500 mt-0.5">Current availability across every club.</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!players && !error && <RowListSkeleton count={6} />}
      {players && players.length === 0 && <p className="text-slate-500 text-sm">No injuries reported.</p>}

      {grouped.length > 0 && (
        <div className="space-y-3">
          {grouped.map(({ teamId, team, rows }) => (
            <div key={teamId} className="rounded-xl bg-surface border border-white/10 shadow-card p-3">
              <Link to={`/teams/${team.slug}`} className="flex items-center gap-2 mb-2 w-fit">
                <TeamBadge team={team} size="sm" />
                <span className="font-display font-bold text-sm text-white hover:text-brand-heliotrope transition-colors duration-150">
                  {team.shortName}
                </span>
              </Link>
              <div className="space-y-1.5">
                {rows.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[13px] font-bold text-white">{p.name}</span>
                      {p.currentStatusNote && (
                        <span className="text-[12px] text-slate-500"> — {p.currentStatusNote}</span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-extrabold tracking-[.04em] uppercase whitespace-nowrap ${STATUS_COLOR[p.currentStatus] ?? "text-white/50"}`}
                    >
                      {p.currentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
