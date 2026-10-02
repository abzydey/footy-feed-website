import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api, Team, Transfer } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import TeamBadge from "../components/TeamBadge";
import TransferRow from "../components/TransferRow";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";

// The season the off-season moves are for: from September on, next year.
function upcomingSeason(): number {
  const now = new Date();
  return now.getFullYear() + (now.getMonth() >= 8 ? 1 : 0);
}

function Section({ title, moves, empty }: { title: string; moves: Transfer[]; empty: string }) {
  return (
    <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-1.5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">{title}</h2>
        <span className="text-[12px] font-bold text-slate-500">{moves.length}</span>
      </div>
      {moves.length === 0 ? (
        <p className="text-[13px] text-slate-500 py-3">{empty}</p>
      ) : (
        moves.map((t, i) => <TransferRow key={t.id} transfer={t} divider={i > 0} />)
      )}
    </section>
  );
}

// Signings tracker: every confirmed move, newest first, or one club's
// gains, losses and re-signings. The club picker is in the URL (?team=)
// so a club's view can be shared or bookmarked.
export default function SigningsPage() {
  const [params, setParams] = useSearchParams();
  const teamSlug = params.get("team") ?? undefined;
  const [moves, setMoves] = useState<Transfer[] | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useDocumentMeta({
    title: "NRL Signings Tracker",
    description: "Every confirmed NRL signing, re-signing and departure, club by club.",
    path: "/signings",
  });

  useEffect(() => {
    api
      .listTransfers()
      .then(setMoves)
      .catch((err) => setError(err.message));
    api.listTeams().then(setTeams).catch(() => setTeams((prev) => prev ?? []));
  }, [refreshTick]);

  const team = teams?.find((t) => t.slug === teamSlug) ?? null;

  const split = useMemo(() => {
    if (!moves || !team) return null;
    return {
      gains: moves.filter((m) => m.kind === "SIGNED" && m.toTeam?.id === team.id),
      losses: moves.filter((m) => m.kind !== "RE_SIGNED" && m.fromTeam?.id === team.id),
      stayed: moves.filter((m) => m.kind === "RE_SIGNED" && m.toTeam?.id === team.id),
    };
  }, [moves, team]);

  const pick = (slug?: string) => {
    const next = new URLSearchParams(params);
    if (slug) next.set("team", slug);
    else next.delete("team");
    setParams(next, { replace: true });
  };

  const chip = (active: boolean) =>
    `shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition-colors duration-150 ${
      active ? "bg-brand-violet text-white border-transparent" : "bg-white/[.04] text-white/60 border-white/[.14] hover:text-white"
    }`;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <PageHero
        eyebrow={`${upcomingSeason()} season`}
        title="Signings Tracker"
        subtitle="Every confirmed signing, re-signing and departure, club by club."
      />

      {teams && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <button type="button" onClick={() => pick()} className={chip(!teamSlug)}>
            All clubs
          </button>
          {teams.map((t) => (
            <button key={t.id} type="button" onClick={() => pick(t.slug)} className={chip(t.slug === teamSlug)}>
              <TeamBadge team={t} size="sm" className="!w-5 !h-5" />
              {t.shortName}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!moves && !error && <FeedSkeleton count={4} />}

      {moves && !team && (
        <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-1.5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">Latest moves</h2>
            <span className="text-[12px] font-bold text-slate-500">{moves.length}</span>
          </div>
          {moves.length === 0 ? (
            <p className="text-[13px] text-slate-500 py-3">No confirmed moves yet.</p>
          ) : (
            moves.map((t, i) => <TransferRow key={t.id} transfer={t} divider={i > 0} />)
          )}
        </section>
      )}

      {split && team && (
        <div className="space-y-4">
          <Section title={`Gains · ${team.shortName}`} moves={split.gains} empty="No new signings confirmed yet." />
          <Section title="Losses" moves={split.losses} empty="No confirmed departures yet." />
          <Section title="Re-signed" moves={split.stayed} empty="No re-signings confirmed yet." />
        </div>
      )}
    </div>
  );
}
