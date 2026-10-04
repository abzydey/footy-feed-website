import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Transfer } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import TransferRow from "./TransferRow";

// One club's off-season moves — gains, losses, re-signings — from the
// signings tracker. Leads a team page's Overview once the club has no games
// left, which is what fans come to a club page for over summer.
export default function TeamMovesCard({ teamId, teamSlug, teamName }: { teamId: string; teamSlug: string; teamName: string }) {
  const [moves, setMoves] = useState<Transfer[] | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api
      .listTransfers({ team: teamSlug })
      .then(setMoves)
      .catch(() => setMoves((prev) => prev ?? []));
  }, [teamSlug, refreshTick]);

  if (!moves) return null;

  const groups: { title: string; list: Transfer[] }[] = [
    { title: "Gains", list: moves.filter((m) => m.kind === "SIGNED" && m.toTeam?.id === teamId) },
    { title: "Losses", list: moves.filter((m) => m.kind !== "RE_SIGNED" && m.fromTeam?.id === teamId) },
    { title: "Re-signed", list: moves.filter((m) => m.kind === "RE_SIGNED" && m.toTeam?.id === teamId) },
  ].filter((g) => g.list.length > 0);

  return (
    <section className="mb-[26px]">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="font-display font-bold text-[19px] tracking-[.06em] text-white uppercase">Off-season moves</h2>
        <Link to={`/signings?team=${teamSlug}`} className="text-[12.5px] font-bold text-brand-violet hover:text-brand-hover">
          Signings tracker →
        </Link>
      </div>
      {groups.length === 0 ? (
        <p className="text-slate-500 text-sm">No confirmed moves for the {teamName} yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.title} className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3 pb-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">{g.title}</h3>
                <span className="text-[12px] font-bold text-slate-500">{g.list.length}</span>
              </div>
              {g.list.map((t, i) => (
                <TransferRow key={t.id} transfer={t} divider={i > 0} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
