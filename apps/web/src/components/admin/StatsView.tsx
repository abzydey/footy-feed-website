import { useEffect, useState } from "react";

import { api, AdminStats } from "../../lib/api";

const PAGE_LABEL: Record<string, string> = {
  home: "Home",
  teams: "Teams",
  games: "Games",
  ladder: "Ladder",
  social: "Social",
  podcasts: "Podcasts",
};

export default function StatsView({ token }: { token: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminGetStats(token).then(setStats).catch((err) => setError(err.message));
  }, [token]);

  if (error) return <p className="text-brand-siren text-sm">{error}</p>;
  if (!stats) return <p className="text-slate-500 text-sm">Loading…</p>;

  const sortedTeams = [...stats.follows.byTeam].sort((a, b) => b.followerCount - a.followerCount);

  return (
    <div className="space-y-6">
      {/* People, not page loads: each browser/app install has an anonymous id.
          Counting started 5 Oct 2026; devices logged into admin aren't counted. */}
      <section className="rounded-xl bg-surface border border-white/10 shadow-card p-4">
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-3">Visitors</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label: "Today", value: stats.visitors.byDay[0]?.visitors ?? 0 },
            { label: "Last 7 days", value: stats.visitors.last7Days },
            { label: "Last 30 days", value: stats.visitors.last30Days },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-display font-extrabold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider py-1.5 border-b border-white/10">
          <span>Day</span>
          <span className="text-right">People</span>
          <span className="text-right">Page views</span>
        </div>
        {stats.visitors.byDay.map((d) => (
          <div key={d.day} className="grid grid-cols-3 gap-2 py-1.5 border-b border-white/10 last:border-0 text-sm">
            <span className="text-slate-300">
              {new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <span className="text-right font-bold text-white">{d.visitors}</span>
            <span className="text-right text-slate-400">{d.views}</span>
          </div>
        ))}
        <p className="text-xs text-slate-500 mt-2">
          Each browser or app install counts once per day. Counting people started 5 Oct 2026 (earlier days show page
          views only). This device isn&apos;t counted while you use admin on it.
        </p>
      </section>

      <section className="rounded-xl bg-surface border border-white/10 shadow-card p-4">
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-3">
          Notification opt-ins
        </h2>
        <p className="text-3xl font-display font-extrabold text-white">{stats.notificationOptIns.total}</p>
        <p className="text-xs text-slate-500 mt-1">
          Browsers/devices that have granted push permission (a Subscriber only exists once permission is granted —
          see schema.prisma).
        </p>
      </section>

      <section className="rounded-xl bg-surface border border-white/10 shadow-card p-4">
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-3">Follows</h2>
        <div className="flex justify-between items-center py-2 border-b border-white/10">
          <span className="text-sm text-slate-300">NRL News</span>
          <span className="font-bold text-white">{stats.follows.generalNewsFollowerCount}</span>
        </div>
        {sortedTeams.map((t) => (
          <div key={t.teamId} className="flex justify-between items-center py-2 border-b border-white/10 last:border-0">
            <span className="text-sm text-slate-300">{t.name}</span>
            <span className="font-bold text-white">{t.followerCount}</span>
          </div>
        ))}
      </section>

      <section className="rounded-xl bg-surface border border-white/10 shadow-card p-4">
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-3">Page views</h2>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 pb-1 border-b border-white/10">
          <span>Page</span>
          <span className="text-right">Last 7 days</span>
          <span className="text-right">All time</span>
        </div>
        {stats.pageViews.byPage.map((p) => (
          <div key={p.page} className="grid grid-cols-3 gap-2 py-2 border-b border-white/10 last:border-0 items-center">
            <span className="text-sm text-slate-300">{PAGE_LABEL[p.page] ?? p.page}</span>
            <span className="text-right font-bold text-white">{p.last7Days}</span>
            <span className="text-right text-slate-400">{p.total}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
