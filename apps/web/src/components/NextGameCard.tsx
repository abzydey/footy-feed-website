import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, Game, LadderRow } from "../lib/api";
import { ordinal } from "../lib/format";
import TeamBadge from "./TeamBadge";

const REMINDERS_KEY = "footy-feed:reminders";

function loadReminders(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(REMINDERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function formatCountdown(kickoffAt: string): string {
  const diffMs = new Date(kickoffAt).getTime() - Date.now();
  if (diffMs <= 0) return "live";
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${totalMins % 60}m`;
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

function TeamColumn({ team, record }: { team: Game["homeTeam"]; record: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <TeamBadge team={team} />
      <div className="text-[15px] font-extrabold tracking-[-.01em] text-white">{team.shortName}</div>
      {record && <div className="text-[11px] font-semibold text-white/42">{record}</div>}
    </div>
  );
}

interface FixtureCardProps {
  game: Game;
  label: string;
  recordFor: (teamId: string) => string | null;
  reminderSet: boolean;
  onToggleReminder: (e: MouseEvent) => void;
  onOpen: () => void;
}

function FixtureCard({ game, label, recordFor, reminderSet, onToggleReminder, onOpen }: FixtureCardProps) {
  const countdown = formatCountdown(game.kickoffAt);
  const live = game.status === "LIVE";

  return (
    <div
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="snap-center shrink-0 w-[85%] sm:w-full cursor-pointer rounded-[18px] p-[1.5px] bg-gradient-to-br from-brand-violet via-brand-heliotrope to-white/[.06]"
    >
      <div className="rounded-[16.5px] bg-[linear-gradient(160deg,#141B33_0%,#0A1024_100%)] px-4 pt-4 pb-[14px]">
        <div className="flex items-center justify-between mb-[14px]">
          <span className="font-display font-bold text-[12.5px] tracking-[.16em] text-white/50 uppercase">
            {game.round} · {label}
          </span>
          <span
            className={`flex items-center gap-[5px] text-[11px] font-bold tracking-[.06em] px-2 py-1 rounded-full uppercase ${
              live ? "text-brand-siren bg-brand-siren/[.14] animate-pulse" : "text-brand-violet bg-brand-violet/[.14]"
            }`}
          >
            {live ? `● Live${game.liveClock ? ` · ${game.liveClock}` : ""}` : countdown === "live" ? "Live" : `In ${countdown}`}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[10px]">
          <TeamColumn team={game.homeTeam} record={recordFor(game.homeTeam.id)} />
          {live ? (
            <span className="font-display font-extrabold text-xl tabular-nums text-white whitespace-nowrap">
              {game.homeScore}&ndash;{game.awayScore}
            </span>
          ) : (
            <span className="font-display font-bold text-[15px] tracking-[.1em] text-white/34">VS</span>
          )}
          <TeamColumn team={game.awayTeam} record={recordFor(game.awayTeam.id)} />
        </div>

        <div className="h-px bg-white/[.08] my-[15px]" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-bold text-white">{formatKickoff(game.kickoffAt)}</div>
            {game.venue && <div className="text-[11.5px] font-medium text-white/45 mt-0.5">{game.venue}</div>}
          </div>
          <button
            type="button"
            onClick={onToggleReminder}
            className={
              reminderSet
                ? "shrink-0 flex items-center gap-1.5 text-[12.5px] font-extrabold tracking-[.03em] uppercase rounded-full px-4 py-2.5 border border-white/25 text-white transition-all duration-150 active:scale-95"
                : "shrink-0 text-[12.5px] font-extrabold tracking-[.03em] uppercase rounded-full px-4 py-2.5 bg-white text-app hover:bg-[#DCD2FF] transition-all duration-150 active:scale-95"
            }
          >
            {reminderSet ? "✓ Reminder set" : "Set reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A horizontally swipeable carousel of the round's remaining fixtures,
// starting at the next one — real data throughout: kickoff/venue from Game,
// W-L/rank from the Ladder (cross-referenced by teamId). Uses native CSS
// scroll-snap rather than a gesture library: touch swipe, trackpad, and
// mouse-wheel scrolling all just work, and a tap still fires the card's
// navigate-to-game click normally since nothing intercepts the gesture.
// "SET REMINDER" is a client-side-only toggle (localStorage) — there's no
// kickoff-push infrastructure behind it yet, unlike the team/player/league
// follow alerts, which are real FCM pushes (see lib/push.ts).
export default function NextGameCard() {
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [allGames, setAllGames] = useState<Game[] | null>(null);
  const [ladder, setLadder] = useState<LadderRow[]>([]);
  const [reminders, setReminders] = useState<Record<string, boolean>>(loadReminders);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    api.listGames().then(setAllGames).catch(() => setAllGames([]));
    api
      .getLadder()
      .then((ladder) => setLadder(ladder.rows))
      .catch(() => setLadder([]));
  }, []);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // A LIVE game keeps a past kickoffAt (see schema.prisma GameStatus design
  // note), so filtering by "kickoffAt > now" alone silently drops it off
  // this carousel the moment kickoff passes — fixed by keeping any LIVE
  // game regardless of its kickoff time, sorted ahead of merely-upcoming
  // ones so it's the first thing shown.
  function byLiveThenSoonest(a: Game, b: Game) {
    if ((a.status === "LIVE") !== (b.status === "LIVE")) return a.status === "LIVE" ? -1 : 1;
    return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
  }

  const fixtures = useMemo(() => {
    if (!allGames) return null;
    const now = Date.now();
    const isRelevant = (g: Game) => g.status === "LIVE" || new Date(g.kickoffAt).getTime() > now;
    const relevant = allGames.filter(isRelevant).sort(byLiveThenSoonest);
    if (relevant.length === 0) return [];
    const anchorRound = relevant[0].round;
    return allGames.filter((g) => g.round === anchorRound && isRelevant(g)).sort(byLiveThenSoonest);
  }, [allGames]);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el || !fixtures || fixtures.length === 0) return;
    const cardWidth = el.scrollWidth / fixtures.length;
    setActiveIndex(Math.round(el.scrollLeft / cardWidth));
  }

  if (fixtures === null) return null; // still loading — no layout shift for a null result
  if (fixtures.length === 0) return null; // no upcoming fixtures this round

  function toggleReminder(e: MouseEvent, gameId: string) {
    e.stopPropagation(); // don't also trigger the card's navigate-to-game click
    setReminders((prev) => {
      const next = { ...prev, [gameId]: !prev[gameId] };
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const recordFor = (teamId: string) => {
    const row = ladder.find((r) => r.team.id === teamId);
    return row ? `${row.wins}-${row.losses} · ${ordinal(row.rank)}` : null;
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {fixtures.map((game, i) => (
          <FixtureCard
            key={game.id}
            game={game}
            label={game.status === "LIVE" ? "Live now" : i === 0 ? "Next up" : `Up next +${i}`}
            recordFor={recordFor}
            reminderSet={!!reminders[game.id]}
            onToggleReminder={(e) => toggleReminder(e, game.id)}
            onOpen={() => navigate(`/games/${game.id}`)}
          />
        ))}
      </div>
      {fixtures.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {fixtures.map((game, i) => (
            <span
              key={game.id}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i === activeIndex ? "w-4 bg-brand-violet" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
