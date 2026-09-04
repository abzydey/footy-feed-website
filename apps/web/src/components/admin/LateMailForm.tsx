import { useState } from "react";

import { api, LateMailMatch, LateMailPlayer, LateMailResult, LateMailTeamSheet } from "../../lib/api";
import { STAGE_LABEL, TeamListStage } from "../../lib/teamListStage";

const STAGES: TeamListStage[] = ["INITIAL", "TWENTY_FOUR_HOUR", "FINAL"];

function playerList(players: LateMailPlayer[]): string {
  return players.map((p) => `${p.number}. ${p.name} (${p.position})`).join(", ");
}

function TeamSheetCard({ token, sheet }: { token: string; sheet: LateMailTeamSheet }) {
  const [stage, setStage] = useState<TeamListStage>(sheet.suggestedStage);
  const [body, setBody] = useState(sheet.generatedBody);
  const [status, setStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canPublish = Boolean(sheet.matchedTeamId && sheet.matchedGameId);

  // Re-fetching the same URL later in the week (see lib/lateMailParser.ts —
  // NRL.com updates this same article in place) should update that stage's
  // existing entry, not pile up a duplicate — same as every hand-entered
  // team-list correction this session used PATCH for.
  async function handlePublish() {
    if (!sheet.matchedTeamId || !sheet.matchedGameId) return;
    setStatus("publishing");
    setError(null);
    try {
      const game = await api.getGame(sheet.matchedGameId);
      const lineup = game.game.homeTeam.id === sheet.matchedTeamId ? game.homeTeamLineup : game.awayTeamLineup;
      const existing = lineup[stage];
      const headline = `${STAGE_LABEL[stage]}: ${sheet.matchedTeamName}`;

      if (existing) {
        await api.adminUpdateEvent(token, existing.id, { body });
      } else {
        await api.adminCreateEvent(token, {
          type: "LINEUP_CHANGE",
          teamListStage: stage,
          teamId: sheet.matchedTeamId,
          gameId: sheet.matchedGameId,
          headline,
          body,
        });
      }
      setStatus("published");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to publish.");
    }
  }

  return (
    <div className="rounded-lg bg-black/30 border border-white/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">
          {sheet.rawTeamName}
          {sheet.matchedTeamName && sheet.matchedTeamName !== sheet.rawTeamName && (
            <span className="text-slate-500 font-normal"> → {sheet.matchedTeamName}</span>
          )}
        </div>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value as TeamListStage)}
          className="bg-black border border-white/20 text-xs text-white px-2 py-1"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {!sheet.matchedTeamId && (
        <p className="text-brand-siren text-xs font-bold">⚠ Couldn't match "{sheet.rawTeamName}" to a Team — can't publish.</p>
      )}
      {sheet.matchedTeamId && !sheet.matchedGameId && (
        <p className="text-brand-siren text-xs font-bold">⚠ No matching Game found for this fixture — can't publish.</p>
      )}
      {sheet.reserveWarning && (
        <p className="text-brand-siren text-xs font-bold">
          ⚠ Only {sheet.reserves.length} reserve{sheet.reserves.length === 1 ? "" : "s"} found on the source page — not
          assumed to be 3, this is what NRL.com actually listed. Double-check before publishing.
        </p>
      )}

      <div className="text-[11px] text-slate-500 space-y-0.5">
        <div>
          <span className="text-slate-600">Starters: </span>
          {playerList(sheet.starters)}
        </div>
        <div>
          <span className="text-slate-600">Interchange: </span>
          {playerList(sheet.interchange)}
        </div>
        <div>
          <span className="text-slate-600">Reserves: </span>
          {sheet.reserves.length > 0 ? playerList(sheet.reserves) : <span className="italic">none listed</span>}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full bg-black border border-white/20 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
      />

      <button
        type="button"
        onClick={handlePublish}
        disabled={!canPublish || status === "publishing"}
        className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-40 text-white font-bold text-xs px-3 py-2 transition-all duration-150 active:scale-[0.98]"
      >
        {status === "publishing" ? "Publishing…" : status === "published" ? "✓ Published — publish again" : `Publish ${STAGE_LABEL[stage]}`}
      </button>
      {status === "error" && <p className="text-brand-siren text-xs">{error}</p>}
    </div>
  );
}

function MatchCard({ token, match }: { token: string; match: LateMailMatch }) {
  return (
    <div className="rounded-xl bg-surface border border-white/10 shadow-card p-3.5 space-y-3">
      <div className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider">{match.matchLabel}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TeamSheetCard token={token} sheet={match.home} />
        <TeamSheetCard token={token} sheet={match.away} />
      </div>
    </div>
  );
}

// Fetches + parses NRL.com's Late Mail page (see lib/lateMailParser.ts on
// the API side) and shows every match/team for review — nothing publishes
// until the admin explicitly hits Publish on that specific team's card.
// The same URL gets updated by NRL.com throughout the week (Tuesday's
// initial squads, then 24hr/Final changes folded into the same page), so
// re-running this later just re-parses whatever's currently there.
export default function LateMailForm({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<LateMailResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setStatus("loading");
    setError(null);
    try {
      setResult(await api.adminParseLateMail(token, url.trim() || undefined));
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to fetch/parse.");
      return;
    }
    setStatus("idle");
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Fetches and parses NRL.com's Late Mail article into team lists for review — nothing is published until you hit
        Publish on an individual team's card below.
      </p>
      <div className="flex items-end gap-2">
        <label className="text-xs text-slate-500 space-y-1 flex-1">
          <span className="block">Late Mail URL (leave blank to auto-find the current one)</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.nrl.com/news/2026/.../nrl-late-mail-round-27.../"
            className="w-full bg-black border border-white/20 px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </label>
        <button
          type="button"
          onClick={handleFetch}
          disabled={status === "loading"}
          className="shrink-0 bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 transition-colors duration-150"
        >
          {status === "loading" ? "Fetching…" : "Fetch"}
        </button>
      </div>
      {status === "error" && <p className="text-brand-siren text-sm">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="text-xs text-slate-500">
            {result.round ?? "Unknown round"} · <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-heliotrope hover:underline">{result.sourceUrl}</a>
          </div>
          {result.narrative && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-500">Article narrative (reference only, not published)</summary>
              <p className="mt-1.5 leading-relaxed">{result.narrative}</p>
            </details>
          )}
          {result.matches.map((m) => (
            <MatchCard key={m.matchLabel} token={token} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}
