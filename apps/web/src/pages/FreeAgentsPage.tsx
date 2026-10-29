import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, FreeAgent, FreeAgentTier, TransferTeam } from "../lib/api";
import {
  byTier,
  drawFreeAgencyGraphic,
  GraphicKind,
  isDone,
  outcomeText,
  TALKS_OPEN_AT,
  TIER_BLURB,
  TIER_LABEL,
  TIER_ORDER,
} from "../lib/freeAgents";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import TeamBadge from "../components/TeamBadge";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";

const POSITIONS = ["Fullback", "Winger", "Centre", "Five-eighth", "Halfback", "Hooker", "Prop", "Second-row", "Lock"];

type View = "top" | "all";
type Show = "all" | "available" | "done";

const chip = (active: boolean) =>
  `shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold whitespace-nowrap transition-colors duration-150 ${
    active ? "bg-brand-violet text-white border-transparent" : "bg-white/[.04] text-white/60 border-white/[.14] hover:text-white"
  }`;

// One player. Crossed off (struck through in purple) once he's re-signed,
// signed elsewhere or retired, with the outcome on the right; tapping a
// crossed-off player opens the story.
function PlayerRow({ p, divider }: { p: FreeAgent; divider: boolean }) {
  const done = isDone(p);
  const details = [p.position, p.team?.shortName].filter(Boolean).join(" · ");
  const content: ReactNode = (
    <>
      {p.team ? <TeamBadge team={p.team} size="sm" /> : <span className="w-8 h-8 shrink-0 rounded-lg bg-surface-inset" aria-hidden="true" />}
      <span className="min-w-0 flex-1 flex flex-col gap-[1px]">
        <span
          className={`font-bold text-[14px] truncate ${done ? "text-slate-400 line-through decoration-brand-violet decoration-2" : "text-white"}`}
        >
          {p.player}
        </span>
        <span className="text-[12.5px] text-slate-400 truncate">
          {details}
          {!done && p.linked.length > 0 && <span className="text-slate-500"> · Linked: {p.linked.map((t) => t.shortName).join(", ")}</span>}
        </span>
        {!done && p.note && <span className="text-[12px] italic text-slate-500">{p.note}</span>}
      </span>
      {done ? (
        <span className="shrink-0 flex items-center gap-1.5">
          {p.status === "SIGNED" && p.newTeam && <TeamBadge team={p.newTeam} size="sm" className="!w-5 !h-5" />}
          <span
            className={`rounded-full px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-wider ${
              p.status === "RE_SIGNED" ? "text-brand-violet bg-brand-violet/[.12]" : p.status === "SIGNED" ? "text-white bg-white/[.08]" : "text-white/55 bg-white/[.05]"
            }`}
          >
            {outcomeText(p)}
          </span>
        </span>
      ) : (
        p.freeAgentNow && (
          <span className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-wider text-brand-violet border border-brand-violet/40">
            On the market
          </span>
        )
      )}
    </>
  );
  const cls = `flex items-center gap-3 py-[11px] ${divider ? "border-t border-white/[.05]" : ""}`;
  if (done && p.story) {
    return (
      <Link to={p.story.isOriginalArticle && p.story.slug ? `/news/${p.story.slug}` : `/story/${p.story.id}`} className={`${cls} hover:opacity-80`}>
        {content}
      </Link>
    );
  }
  return <div className={cls}>{content}</div>;
}

function Group({ title, blurb, players }: { title: string; blurb?: string; players: FreeAgent[] }) {
  const done = players.filter(isDone).length;
  return (
    <section className="rounded-[18px] bg-surface border border-white/[.07] px-4 pt-3.5 pb-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">{title}</h2>
        <span className="text-[12px] font-bold text-slate-500">
          {done} of {players.length} signed
        </span>
      </div>
      {blurb && <p className="text-[12.5px] text-slate-500 mt-0.5">{blurb}</p>}
      <div className="mt-1">
        {players.map((p, i) => (
          <PlayerRow key={p.id} p={p} divider={i > 0} />
        ))}
      </div>
    </section>
  );
}

// Builds the social post from the live list and offers it to save or share.
function GraphicMaker({ players, season, club, onClose }: { players: FreeAgent[]; season: number; club: TransferTeam | null; onClose: () => void }) {
  const clubs = useMemo(() => {
    const seen = new Map<string, TransferTeam>();
    for (const p of players) if (p.team) seen.set(p.team.id, p.team);
    return [...seen.values()].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [players]);
  const [kind, setKind] = useState<GraphicKind>(club ? "club" : "top");
  const [clubId, setClubId] = useState<string>(club?.id ?? clubs[0]?.id ?? "");
  const [url, setUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const c = canvas.current ?? (canvas.current = document.createElement("canvas"));
    const chosen = clubs.find((t) => t.id === clubId) ?? null;
    drawFreeAgencyGraphic(c, { kind, players, club: chosen, season }).then(() => {
      c.toBlob((blob) => {
        if (!blob || cancelled) return;
        const name = `fullset-free-agency-${kind === "club" ? chosen?.slug ?? "club" : kind}.png`;
        setFile(new File([blob], name, { type: "image/png" }));
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      }, "image/png");
    });
    return () => {
      cancelled = true;
    };
  }, [kind, clubId, players, season, clubs]);

  const canShare = file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  return (
    <section className="rounded-[18px] bg-surface border border-brand-violet/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">Make a post</h2>
        <button type="button" onClick={onClose} className="text-[12.5px] font-bold text-slate-400 hover:text-white">
          Close
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(kind === "top")} onClick={() => setKind("top")}>
          Top free agents
        </button>
        <button type="button" className={chip(kind === "available")} onClick={() => setKind("available")}>
          Still available
        </button>
        <button type="button" className={chip(kind === "club")} onClick={() => setKind("club")}>
          One club
        </button>
        {kind === "club" && (
          <select
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
            className="rounded-full bg-white/[.04] border border-white/[.14] px-3 py-1.5 text-[12.5px] font-bold text-white"
          >
            {clubs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </select>
        )}
      </div>
      {url ? (
        <img src={url} alt="Free agency post preview" className="w-full max-w-[420px] rounded-xl border border-white/[.07]" />
      ) : (
        <div className="w-full max-w-[420px] aspect-[4/5] rounded-xl bg-surface-inset animate-pulse" />
      )}
      <div className="flex flex-wrap gap-2">
        {url && file && (
          <a href={url} download={file.name} className="rounded-full bg-brand-violet px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-hover">
            Download
          </a>
        )}
        {canShare && (
          <button
            type="button"
            onClick={() => navigator.share({ files: [file!] }).catch(() => {})}
            className="rounded-full border border-white/[.14] px-4 py-2 text-[13px] font-bold text-white hover:border-brand-violet/50"
          >
            Share
          </button>
        )}
      </div>
    </section>
  );
}

// Free agency tracker: every player off contract at the end of 2027 (free
// to talk to rival clubs from 1 November), crossed off as each one
// re-signs or moves — straight from the signings tracker. Club and
// position filters live in the URL (?team=, ?position=) so a view can be
// shared.
export default function FreeAgentsPage() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ season: number; players: FreeAgent[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const refreshTick = useRefreshTick();

  const teamSlug = params.get("team") ?? undefined;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const position = params.get("position") ?? undefined;
  // Searching looks through everyone, not just the top tiers.
  const view: View = params.get("view") === "all" || teamSlug || position || q ? "all" : "top";
  const show = (params.get("show") as Show | null) ?? "all";

  useDocumentMeta({
    title: "NRL Free Agency Tracker 2028",
    description: "Every NRL player off contract at the end of 2027, crossed off as they re-sign or move. Free agency opens November 1.",
    path: "/free-agents",
  });

  useEffect(() => {
    api
      .listFreeAgents()
      .then(setData)
      .catch((err) => setError(err.message));
  }, [refreshTick]);

  const set = (key: string, value?: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const players = data?.players ?? [];
  const clubs = useMemo(() => {
    const seen = new Map<string, TransferTeam>();
    for (const p of players) if (p.team) seen.set(p.team.slug, p.team);
    return [...seen.values()].sort((a, b) => a.shortName.localeCompare(b.shortName));
  }, [players]);
  const club = clubs.find((t) => t.slug === teamSlug) ?? null;

  const filtered = useMemo(
    () =>
      players.filter(
        (p) =>
          (!teamSlug || p.team?.slug === teamSlug) &&
          (!position || p.position === position) &&
          (!q || p.player.toLowerCase().includes(q)) &&
          (show === "all" || (show === "done" ? isDone(p) : !isDone(p)))
      ),
    [players, teamSlug, position, show, q]
  );

  const doneCount = players.filter(isDone).length;
  const top = players.filter((p) => p.tier);
  const topDone = top.filter(isDone).length;
  const daysToOpen = Math.ceil((TALKS_OPEN_AT - Date.now()) / 86_400_000);

  // Top view: one card per tier. Everyone view: one card per club, or a
  // single list when a club or position is picked.
  const groups: { title: string; blurb?: string; players: FreeAgent[] }[] = [];
  if (view === "top") {
    for (const t of TIER_ORDER) {
      const inTier = filtered.filter((p) => p.tier === (t as FreeAgentTier));
      if (inTier.length) groups.push({ title: TIER_LABEL[t], blurb: TIER_BLURB[t], players: inTier });
    }
  } else if (club || position || q) {
    if (filtered.length) groups.push({ title: [club?.shortName, position, q && `“${query.trim()}”`].filter(Boolean).join(" · "), players: [...filtered].sort(byTier) });
  } else {
    for (const t of clubs) {
      const ofClub = filtered.filter((p) => p.team?.slug === t.slug).sort(byTier);
      if (ofClub.length) groups.push({ title: t.shortName, players: ofClub });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <PageHero
        eyebrow={`Free agency · ${data?.season ?? 2028} season`}
        title="Free Agent Tracker"
        subtitle="Every player off contract at the end of 2027, crossed off as they re-sign or move."
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!data && !error && <FeedSkeleton count={4} />}

      {data && (
        <>
          <section className="rounded-[18px] bg-surface border border-white/[.07] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display italic font-black text-[34px] leading-none text-white tabular-nums">
                  {doneCount}
                  <span className="text-slate-500 text-[22px]"> / {players.length}</span>
                </div>
                <div className="text-[13px] font-bold text-slate-400 mt-1">off the market</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-bold text-white">
                  {topDone} of {top.length} top free agents signed
                </div>
                <div className="text-[12.5px] text-slate-500 mt-0.5">
                  {daysToOpen > 1 ? `Talks with rival clubs open in ${daysToOpen} days` : daysToOpen === 1 ? "Talks with rival clubs open tomorrow" : "The market is open"}
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/[.08] overflow-hidden">
              <div className="h-full bg-brand-violet rounded-full" style={{ width: `${players.length ? (doneCount / players.length) * 100 : 0}%` }} />
            </div>
            {!making && (
              <button type="button" onClick={() => setMaking(true)} className="mt-3 text-[12.5px] font-bold text-brand-violet hover:text-brand-hover">
                Make a post for social →
              </button>
            )}
          </section>

          {making && <GraphicMaker players={players} season={data.season} club={club} onClose={() => setMaking(false)} />}

          <div className="space-y-2.5">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search all ${players.length} players`}
              className="w-full rounded-full bg-white/[.04] border border-white/[.14] px-4 py-2 text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-violet/60"
            />
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <button type="button" className={chip(view === "top")} onClick={() => setParams(new URLSearchParams(show !== "all" ? { show } : {}), { replace: true })}>
                Top free agents
              </button>
              <button type="button" className={chip(view === "all" && !teamSlug && !position)} onClick={() => set("view", "all")}>
                Everyone
              </button>
              <span className="w-px shrink-0 bg-white/[.1] mx-1" aria-hidden="true" />
              {(["all", "available", "done"] as Show[]).map((s) => (
                <button key={s} type="button" className={chip(show === s)} onClick={() => set("show", s === "all" ? undefined : s)}>
                  {s === "all" ? "All" : s === "available" ? "Available" : "Signed"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {clubs.map((t) => (
                <button key={t.id} type="button" onClick={() => set("team", t.slug === teamSlug ? undefined : t.slug)} className={chip(t.slug === teamSlug)}>
                  <TeamBadge team={t} size="sm" className="!w-5 !h-5" />
                  {t.shortName}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {POSITIONS.map((pos) => (
                <button key={pos} type="button" onClick={() => set("position", pos === position ? undefined : pos)} className={chip(pos === position)}>
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="text-[13.5px] text-slate-500 text-center py-6">No players match.</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <Group key={g.title} title={g.title} blurb={g.blurb} players={g.players} />
              ))}
              {view === "top" && (
                <button
                  type="button"
                  onClick={() => set("view", "all")}
                  className="w-full rounded-[14px] border border-white/[.1] py-3 text-[13.5px] font-bold text-brand-violet hover:border-brand-violet/50"
                >
                  See all {players.length} players, club by club →
                </button>
              )}
            </div>
          )}

          <p className="text-[12px] text-slate-500">
            A player is crossed off when his deal is confirmed — see every move on the{" "}
            <Link to="/signings" className="font-bold text-brand-violet hover:text-brand-hover">
              signings tracker
            </Link>
            . “Linked” clubs are from reports, not done deals.
          </p>
        </>
      )}
    </div>
  );
}
