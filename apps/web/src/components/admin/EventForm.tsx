import { FormEvent, useEffect, useState } from "react";

import { api, EventItem, Game, Player, Team } from "../../lib/api";
import { STAGE_LABEL, TeamListStage } from "../../lib/teamListStage";

const EVENT_TYPES = ["NEWS", "INJURY", "LINEUP_CHANGE", "TRANSFER", "GENERAL_NEWS", "SOCIAL_POST"] as const;
const STATUSES = ["AVAILABLE", "QUESTIONABLE", "OUT", "INJURED", "SUSPENDED"] as const;
const STAGES: TeamListStage[] = ["INITIAL", "TWENTY_FOUR_HOUR", "FINAL"];

export default function EventForm({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);

  const [teamSlug, setTeamSlug] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [gameId, setGameId] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("NEWS");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [newStatus, setNewStatus] = useState<(typeof STATUSES)[number] | "">("");
  const [teamListStage, setTeamListStage] = useState<TeamListStage | "">("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    api.listTeams().then(setTeams);
    api.listGames().then(setGames);
    refreshEvents();
  }, []);

  useEffect(() => {
    if (!teamSlug) {
      setPlayers([]);
      return;
    }
    api.getTeamBrief(teamSlug).then((data) => setPlayers(data.players));
  }, [teamSlug]);

  function refreshEvents() {
    api.adminListEvents(token).then(setRecentEvents).catch(() => onLogout());
  }

  const selectedTeam = teams.find((t) => t.slug === teamSlug);

  // GENERAL_NEWS and SOCIAL_POST are both feed-only content that usually
  // isn't tied to one team — hide the team/player selects for either.
  const isUntargeted = type === "GENERAL_NEWS" || type === "SOCIAL_POST";
  const isSocialPost = type === "SOCIAL_POST";
  const isGeneralNews = type === "GENERAL_NEWS";
  const isLineupChange = type === "LINEUP_CHANGE";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await api.adminCreateEvent(token, {
        type,
        teamId: isUntargeted ? undefined : selectedTeam?.id,
        playerId: isUntargeted ? undefined : playerId || undefined,
        gameId: type === "GENERAL_NEWS" ? undefined : gameId || undefined,
        headline,
        body,
        newStatus: type === "INJURY" ? newStatus || undefined : undefined,
        teamListStage: type === "LINEUP_CHANGE" ? teamListStage || undefined : undefined,
        sourceUrl: sourceUrl || undefined,
        sourceName: sourceName || undefined,
        sourceAuthor: sourceAuthor || undefined,
      });
      setStatus("saved");
      setHeadline("");
      setBody("");
      setSourceUrl("");
      setSourceName("");
      setSourceAuthor("");
      refreshEvents();
    } catch (err) {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl bg-surface border border-white/10 shadow-card p-4"
      >
        <div className={`grid gap-3 ${isUntargeted ? "grid-cols-1" : "grid-cols-2"}`}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {!isUntargeted && (
            <select
              value={teamSlug}
              onChange={(e) => {
                setTeamSlug(e.target.value);
                setPlayerId("");
              }}
              className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
            >
              <option value="">Select team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {isUntargeted ? (
          <p className="text-xs text-slate-500">
            {isSocialPost
              ? "League-wide or social post — no team or player needed."
              : "League-wide — no team or player needed. This goes out to fans following \"General NRL News\"."}
          </p>
        ) : (
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">(Team-level — no specific player)</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {type !== "GENERAL_NEWS" && (
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">(Not tied to a specific game)</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.homeTeam.shortName} vs {g.awayTeam.shortName} — {g.round}
              </option>
            ))}
          </select>
        )}

        {type === "LINEUP_CHANGE" && (
          <select
            value={teamListStage}
            onChange={(e) => setTeamListStage(e.target.value as TeamListStage)}
            required
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">Team list stage…</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        )}

        {type === "INJURY" && (
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as typeof newStatus)}
            className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          >
            <option value="">New status…</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder={isSocialPost ? "Headline / handle (short)" : isGeneralNews ? "Headline (as published)" : "Headline (short)"}
          required
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        {isGeneralNews && (
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Summary</label>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            isSocialPost
              ? "Short summary text / post text"
              : isGeneralNews
                ? "Write your own short paragraph on the article's main points — not copied text"
                : isLineupChange
                  ? "1. Name, 2. Name, ... 13. Name. Bench: 14. Name, 15. Name, 16. Name, 17. Name, 18. Name, 19. Name."
                  : "Short summary text"
          }
          required
          rows={isLineupChange ? 5 : 3}
          className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
        />
        {isGeneralNews && (
          <p className="text-xs text-slate-500">
            Write this yourself, in plain language — the source may be paywalled, so this summary is often the only
            part a reader can actually access. The headline above can be copied as published; the URL below is the
            "Read more" link to the original.
          </p>
        )}
        {isLineupChange && (
          <p className="text-xs text-slate-500">
            Number every player, starters through bench — the interchange bench is 6 players (14-19), not 4. Only
            leave a player unnumbered if they're a genuine train-on reserve outside the 19-man squad.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <input
            value={sourceAuthor}
            onChange={(e) => setSourceAuthor(e.target.value)}
            placeholder={isGeneralNews ? 'Author (e.g. "Michael Chammas")' : "Author (optional)"}
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
          <input
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder={isGeneralNews ? 'Source name (e.g. "Daily Telegraph")' : "Source name (optional)"}
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder={isGeneralNews ? "Source URL (Read more link)" : "Source URL (optional)"}
            className="bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
          />
        </div>

        <button
          disabled={status === "saving"}
          className="w-full bg-brand-violet hover:bg-brand-violet/90 disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
        >
          {status === "saving" ? "Saving…" : "Publish update"}
        </button>
        {status === "saved" && <p className="text-emerald-400 text-sm">Published — followers notified.</p>}
        {status === "error" && <p className="text-brand-siren text-sm">Failed to save.</p>}
      </form>

      <section>
        <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">Recent entries</h2>
        <div>
          {recentEvents.map((event) => (
            <div key={event.id} className="border-b border-white/10 py-3 text-sm">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{event.type}</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-white font-bold">{event.headline}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
