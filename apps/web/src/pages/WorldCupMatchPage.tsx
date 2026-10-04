import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, TeamListStages, WorldCupMatch } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import Flag from "../components/Flag";
import TeamListCard from "../components/TeamListCard";
import WorldCupMatchCard from "../components/WorldCupMatchCard";
import SectionLabel from "../components/ui/SectionLabel";
import { FeedSkeleton } from "../components/ui/Skeleton";

const hasList = (s: TeamListStages) => Boolean(s.INITIAL || s.TWENTY_FOUR_HOUR || s.FINAL);

// One World Cup game: the match card, then both nations' team lists
// (initial, 24-hour and final updates, synced from the official site) in the
// same card the club game page uses.
export default function WorldCupMatchPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ match: WorldCupMatch; home: TeamListStages; away: TeamListStages } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    if (!id) return;
    api.getWorldCupMatch(id).then(setData).catch((err) => setError(err.message));
  }, [id, refreshTick]);

  const m = data?.match;
  useDocumentMeta({
    title: m ? `${m.homeName} v ${m.awayName} — World Cup ${m.roundName}` : "World Cup",
    description: m ? `Team lists for ${m.homeName} v ${m.awayName}, Rugby League World Cup ${m.roundName}.` : "Rugby League World Cup game",
    path: `/world-cup/${id ?? ""}`,
  });

  const nation = (name: string, abbr: string) => (
    <span className="flex items-center gap-2.5 font-display font-extrabold text-white">
      <Flag abbr={abbr} className="w-7 h-[21px]" />
      {name}
    </span>
  );

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto p-4 lg:px-5 lg:pt-7 space-y-6">
      <Link to="/world-cup" className="inline-block text-[13px] font-bold text-brand-violet hover:text-brand-hover">
        ← World Cup
      </Link>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!data && !error && <FeedSkeleton count={3} />}

      {data && m && (
        <>
          <WorldCupMatchCard
            match={m}
            footer={
              <span className="shrink-0 flex items-center gap-4">
                {m.status === "SCHEDULED" && m.ticketUrl && (
                  <a href={m.ticketUrl} target="_blank" rel="noreferrer" className="text-[12.5px] lg:text-[14px] font-bold text-slate-300 hover:text-white">
                    Tickets
                  </a>
                )}
                {m.matchCentreUrl && (
                  <a href={m.matchCentreUrl} target="_blank" rel="noreferrer" className="text-[12.5px] lg:text-[14px] font-bold text-brand-violet">
                    Official match centre →
                  </a>
                )}
              </span>
            }
          />

          <section>
            <SectionLabel>Team lists</SectionLabel>
            {m.homeAbbr === "TBA" ? (
              <p className="text-slate-500 text-sm">Team lists will appear once both teams are decided.</p>
            ) : !hasList(data.home) && !hasList(data.away) ? (
              <p className="text-slate-500 text-sm">Not named yet — they'll appear here automatically once announced.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TeamListCard stages={data.home} kickoffAt={null} header={nation(m.homeName, m.homeAbbr)} />
                <TeamListCard stages={data.away} kickoffAt={null} header={nation(m.awayName, m.awayAbbr)} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
