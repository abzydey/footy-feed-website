import { ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Game } from "../lib/api";
import { teamColors } from "../lib/teamBadge";
import TeamBadge from "./TeamBadge";

// "2d 06h" / "6h 12m" / "12m" until kickoff.
function countdownTo(iso: string, now: number): string {
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

function HeroTeam({ team, align, linkTeam }: { team: Game["homeTeam"]; align: "start" | "end"; linkTeam: boolean }) {
  const name = (
    <span className="font-extrabold text-[15px] text-white truncate max-w-full lg:font-display lg:italic lg:font-black lg:text-[24px] lg:uppercase">
      {team.shortName}
    </span>
  );
  return (
    <div
      className={`flex flex-col items-center gap-2 min-w-0 lg:flex-row lg:gap-4 ${
        align === "end" ? "lg:flex-row-reverse lg:text-right" : ""
      }`}
    >
      <TeamBadge team={team} size="xl" />
      {linkTeam ? (
        <Link to={`/teams/${team.slug}`} className="min-w-0 max-w-full truncate hover:opacity-80">
          {name}
        </Link>
      ) : (
        name
      )}
    </div>
  );
}

interface MatchHeroProps {
  game: Game;
  // Home: the whole card opens the game page. On the game page itself it
  // isn't a link — the team names link to their team pages instead.
  linkTo?: string;
  // Extra rows under the scoreline, e.g. the try scorers on the game page.
  children?: ReactNode;
}

// One match card for every state: a countdown before kickoff, the live
// score and clock during the game, the final score after. A stripe in both
// clubs' colours across the top. Used on Home, the game page and Finals.
export default function MatchHero({ game, linkTo, children }: MatchHeroProps) {
  const live = game.status === "LIVE";
  const finished = game.status === "FULL_TIME";
  const now = useNow(30_000);
  const stripe = [...teamColors(game.homeTeam), ...teamColors(game.awayTeam)];

  const status = live
    ? { text: `● Live${game.liveClock ? ` · ${game.liveClock}` : ""}`, cls: "text-brand-siren" }
    : finished
      ? { text: "Full time", cls: "text-slate-300" }
      : { text: kickoffLabel(game.kickoffAt), cls: "text-slate-400" };

  const body = (
    <>
      <div className="flex h-1 lg:h-[5px]" aria-hidden="true">
        {stripe.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div className="px-[18px] pt-4 pb-[18px] lg:px-7 lg:pt-[22px] lg:pb-6 flex flex-col gap-4 lg:gap-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-display italic font-black text-[13px] lg:text-[15px] tracking-[.14em] text-brand-violet uppercase">
            {game.round}
          </span>
          <span className={`text-[12.5px] lg:text-[14px] font-semibold ${status.cls}`}>{status.text}</span>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-center">
          <HeroTeam team={game.homeTeam} align="start" linkTeam={!linkTo} />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display italic font-black text-[28px] lg:text-[40px] leading-none text-white tabular-nums whitespace-nowrap">
              {live || finished ? `${game.homeScore ?? 0}–${game.awayScore ?? 0}` : countdownTo(game.kickoffAt, now)}
            </span>
            <span className="text-[11px] lg:text-[12px] font-bold tracking-[.12em] text-slate-400 uppercase">
              {live ? "Score" : finished ? "Final" : "To kick-off"}
            </span>
          </div>
          <HeroTeam team={game.awayTeam} align="end" linkTeam={!linkTo} />
        </div>

        {children}

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[.07]">
          <span className="text-[12.5px] lg:text-[13.5px] text-slate-400 truncate">
            {game.venue}
            {game.weatherFlag && <span title={game.weatherNote ?? "Weather-affected fixture"}> · ☔ {game.weatherNote ?? ""}</span>}
          </span>
          {linkTo && <span className="shrink-0 text-[12.5px] lg:text-[14px] font-bold text-brand-violet">Match centre →</span>}
        </div>
      </div>
    </>
  );

  const shell = "block rounded-[22px] overflow-hidden border border-brand-violet/35 bg-surface";
  return linkTo ? (
    <Link to={linkTo} className={`${shell} hover:border-brand-violet/60 transition-colors duration-150`}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
