import { Link } from "react-router-dom";

import { EventItem, Team, TeamListStages } from "../lib/api";
import { STAGE_BADGE_CLASS, STAGE_LABEL, TeamListStage } from "../lib/teamListStage";
import TeamBadge from "./TeamBadge";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatExpected(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface NumberedPlayer {
  number: number;
  name: string;
}

interface ParsedTeamList {
  starters: NumberedPlayer[];
  bench: NumberedPlayer[];
  reserves: NumberedPlayer[];
}

// Matches "14. Blake Mozer" style tokens wherever they appear in a team-list
// body — including right after a "Bench:"/"Reserves:" label, since those are
// followed by the same "N. Name" pattern. Requires the digits to be
// immediately followed by a literal "." (not just any digits — "1-19" or
// "20th" in a free-text update like "named 1-19 as originally listed" or
// "Blake Wilson is the 20th man" won't match), so a short change blurb
// naturally parses to zero entries rather than a broken partial table.
const NUMBERED_PLAYER = /(\d{1,2})\.\s*([^,.]+?)(?=,|\.|$)/g;

function extractPlayers(segment: string): NumberedPlayer[] {
  return [...segment.matchAll(NUMBERED_PLAYER)].map((m) => ({ number: Number(m[1]), name: m[2].trim() }));
}

// Splits into starters/bench/reserves by the "Bench:"/"Reserves:" section
// labels admin entries always use, rather than by jersey number range — a
// number alone doesn't reliably say which tier a player's actually in (a
// starter dropping back to interchange keeps their real number rather than
// being renumbered into the 14-19 range, and a special tribute jersey like
// a one-off No.23 for a milestone game shouldn't get shuffled into
// "Reserves" just because 23 is a high number).
function parseTeamList(body: string): ParsedTeamList | null {
  const totalMatches = [...body.matchAll(NUMBERED_PLAYER)];
  if (totalMatches.length < 10) return null; // doesn't look like a full team sheet — render as plain text instead

  const benchIdx = body.indexOf("Bench:");
  const reservesIdx = body.indexOf("Reserves:");

  if (benchIdx === -1) {
    // No section labels present — fall back to the old number-range
    // bucketing so a body without them still renders sensibly.
    const players = totalMatches.map((m) => ({ number: Number(m[1]), name: m[2].trim() }));
    return {
      starters: players.filter((p) => p.number <= 13),
      bench: players.filter((p) => p.number >= 14 && p.number <= 19),
      reserves: players.filter((p) => p.number >= 20),
    };
  }

  return {
    starters: extractPlayers(body.slice(0, benchIdx)),
    bench: extractPlayers(reservesIdx === -1 ? body.slice(benchIdx) : body.slice(benchIdx, reservesIdx)),
    reserves: reservesIdx === -1 ? [] : extractPlayers(body.slice(reservesIdx)),
  };
}

// Pulls the comma-separated names out of a 24hr/Final update's "Omitted
// from the NN — Name, Name." clause (see routes/events.ts admin entries) —
// used to strike those names through on the INITIAL roster grid so it's
// obvious at a glance who dropped out later, without losing the original
// full list.
const OMITTED_NAMES = /Omitted from the \d+ — ([^.]+)\./;

function parseOmittedNames(body: string | undefined): string[] {
  if (!body) return [];
  const match = body.match(OMITTED_NAMES);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

// Names on the Final grid that occupy a different slot than they (or
// whoever was there before) did on the Initial grid — a position swap, or
// a bench/reserve player promoted into the run-on side. Starters are
// compared slot-by-slot (jersey number tracks the player, not the
// position, per NRL convention and this app's own data — see
// nrl_jersey_number_positions memory — so list order, not number, is what
// actually encodes "which position" for 1-13). Bench is compared as a set,
// not by slot order: bench interchange order carries no positional
// meaning the way starters 1-13 do, and comparing by order would falsely
// flag every player listed after whoever actually moved, just because
// removing one name shifts everyone else's index.
function computeChangedNames(initialBody: string | undefined, finalBody: string | undefined): Set<string> {
  if (!initialBody || !finalBody) return new Set();
  const initial = parseTeamList(initialBody);
  const final = parseTeamList(finalBody);
  if (!initial || !final) return new Set();

  const changed = new Set<string>();
  final.starters.forEach((p, i) => {
    if (initial.starters[i]?.name.toLowerCase() !== p.name.toLowerCase()) changed.add(p.name.toLowerCase());
  });
  const initialBenchNames = new Set(initial.bench.map((p) => p.name.toLowerCase()));
  for (const p of final.bench) {
    if (!initialBenchNames.has(p.name.toLowerCase())) changed.add(p.name.toLowerCase());
  }
  return changed;
}

// 24hr and Final are the two checkpoints with a real, computable
// kickoff-relative expectation (~24h and ~1.5h before kickoff respectively —
// see schema.prisma design notes on TeamListStage). INITIAL ("Tuesday
// release") doesn't have a simple kickoff-relative timing, so its
// placeholder below skips the "Expected around <time>" line rather than
// guessing a date — but it still reserves the row (see StageRow) so the
// card always shows all three checkpoints instead of silently skipping
// straight to "24hr Update" for a fixture nothing's been logged for yet.
const PLACEHOLDER_OFFSET_MS: Partial<Record<TeamListStage, number>> = {
  TWENTY_FOUR_HOUR: 24 * 60 * 60 * 1000,
  FINAL: 90 * 60 * 1000,
};

function StageRow({
  stage,
  event,
  kickoffAt,
  omittedNames,
  changedNames,
}: {
  stage: TeamListStage;
  event: EventItem | null;
  kickoffAt: string;
  omittedNames: Set<string>;
  changedNames: Set<string>;
}) {
  if (!event) {
    const offsetMs = PLACEHOLDER_OFFSET_MS[stage];
    const expectedAt = offsetMs !== undefined ? new Date(new Date(kickoffAt).getTime() - offsetMs).toISOString() : null;
    return (
      <div className="rounded-lg border border-dashed border-white/15 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {stage === "FINAL" && "🚨 "}
            {STAGE_LABEL[stage]}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            Pending
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {expectedAt ? <>Expected around {formatExpected(expectedAt)}</> : "Not yet released"}
        </p>
      </div>
    );
  }

  const isFinal = stage === "FINAL";
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isFinal ? "border-2 border-brand-siren/60" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${STAGE_BADGE_CLASS[stage]}`}>
          {isFinal && "🚨 "}
          {STAGE_LABEL[stage]}
        </span>
        <span className="text-[10px] text-slate-500">{timeAgo(event.createdAt)}</span>
      </div>
      <TeamListBody body={event.body} omittedNames={omittedNames} changedNames={changedNames} />
    </div>
  );
}

function PlayerColumn({
  label,
  players,
  omittedNames,
  changedNames,
}: {
  label: string;
  players: NumberedPlayer[];
  omittedNames: Set<string>;
  changedNames: Set<string>;
}) {
  if (players.length === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">{label}</div>
      {players.map((p) => {
        const omitted = omittedNames.has(p.name.toLowerCase());
        const changed = changedNames.has(p.name.toLowerCase());
        return (
          <div key={p.number} className="flex gap-1.5 text-[12.5px] leading-tight">
            <span className="shrink-0 w-4 text-slate-500 tabular-nums">{p.number}</span>
            <span
              className={
                omitted
                  ? "text-slate-500 line-through truncate"
                  : changed
                    ? "text-brand-heliotrope font-bold truncate"
                    : "text-slate-200 truncate"
              }
            >
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// A full team sheet ("1. Name, 2. Name, ... Bench: 14. Name, ...") renders
// as two columns — starters (1-13) left, bench (14-19) + reserves (20+)
// stacked in the right column, matching official NRL terminology (a 6-man
// interchange bench, with anyone beyond that a train-on reserve) — so it
// scans like a real team sheet instead of one dense paragraph. A short
// change blurb ("Jed Reardon replaces Jack Underhill on the bench") doesn't
// parse into numbered entries (see parseTeamList) and just renders as-is.
function TeamListBody({
  body,
  omittedNames,
  changedNames,
}: {
  body: string;
  omittedNames: Set<string>;
  changedNames: Set<string>;
}) {
  const parsed = parseTeamList(body);
  if (!parsed) {
    return <p className="text-slate-300 text-sm leading-relaxed mt-1.5">{body}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 mt-1.5">
      <PlayerColumn label="Starters" players={parsed.starters} omittedNames={omittedNames} changedNames={changedNames} />
      <div className="space-y-2">
        <PlayerColumn label="Bench" players={parsed.bench} omittedNames={omittedNames} changedNames={changedNames} />
        <PlayerColumn label="Reserves" players={parsed.reserves} omittedNames={omittedNames} changedNames={changedNames} />
      </div>
    </div>
  );
}

/**
 * One team's full team-list checkpoint history for a game — INITIAL (only
 * if logged), then 24hr and Final always shown, each either the real logged
 * update or an auto-computed "pending, expected around <time>" placeholder
 * (see PLACEHOLDER_OFFSET_MS) until the admin logs it. Applies to every game
 * automatically — nothing to configure per fixture.
 */
export default function TeamListCard({ team, stages, kickoffAt }: { team: Team; stages: TeamListStages; kickoffAt: string }) {
  const omittedNames = new Set(
    [...parseOmittedNames(stages.TWENTY_FOUR_HOUR?.body), ...parseOmittedNames(stages.FINAL?.body)].map((n) =>
      n.toLowerCase()
    )
  );
  // Each stage's highlights are computed independently against INITIAL, not
  // chained stage-to-stage — so if FINAL reverts a 24hr-stage change back to
  // the original name, that player correctly stops being flagged, rather
  // than staying highlighted just because 24hr once differed.
  const changedAt24hr = computeChangedNames(stages.INITIAL?.body, stages.TWENTY_FOUR_HOUR?.body);
  const changedAtFinal = computeChangedNames(stages.INITIAL?.body, stages.FINAL?.body);

  return (
    <div className="rounded-xl bg-surface border border-white/10 p-4 shadow-card space-y-2.5">
      <Link
        to={`/teams/${team.slug}`}
        className="flex items-center gap-2.5 font-display font-extrabold text-white hover:text-brand-heliotrope transition-colors duration-150"
      >
        <TeamBadge team={team} size="sm" />
        {team.shortName}
      </Link>
      <div className="space-y-2">
        {/* omittedNames only ever applies to the INITIAL grid — it's the
            "who got cut from this original list" annotation. A 24hr/Final
            grid renders its own actual current squad, so a name appearing
            there is present, full stop — even if an earlier stage's
            sentence once dropped them and a later one brought them back
            (e.g. a player omitted at 24hr, then recalled for Final). Passing
            the same combined set to every stage struck that recalled name
            through on its own Final listing, which is exactly backwards. */}
        <StageRow stage="INITIAL" event={stages.INITIAL} kickoffAt={kickoffAt} omittedNames={omittedNames} changedNames={new Set()} />
        <StageRow
          stage="TWENTY_FOUR_HOUR"
          event={stages.TWENTY_FOUR_HOUR}
          kickoffAt={kickoffAt}
          omittedNames={new Set()}
          changedNames={changedAt24hr}
        />
        <StageRow stage="FINAL" event={stages.FINAL} kickoffAt={kickoffAt} omittedNames={new Set()} changedNames={changedAtFinal} />
      </div>
    </div>
  );
}
