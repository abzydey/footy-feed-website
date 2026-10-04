import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, WorldCupMatch } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import { featuredMatch, worldCupActive } from "../lib/worldCup";
import WorldCupMatchCard from "./WorldCupMatchCard";

// Home's World Cup slot — only while the tournament is on (a fortnight
// before the first game until a week after the Final): the live or next
// game, with a way into the World Cup page.
export default function WorldCupHomeCard() {
  const [matches, setMatches] = useState<WorldCupMatch[] | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api.listWorldCupMatches().then(setMatches).catch(() => setMatches((prev) => prev ?? []));
  }, [refreshTick]);

  if (!matches || !worldCupActive(matches)) return null;
  const m = featuredMatch(matches);
  if (!m) return null;

  return (
    <Link to="/world-cup" className="block hover:opacity-95">
      <WorldCupMatchCard
        match={m}
        kicker="Rugby League World Cup"
        footer={<span className="shrink-0 text-[12.5px] lg:text-[14px] font-bold text-brand-violet">World Cup →</span>}
      />
    </Link>
  );
}
