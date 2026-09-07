import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { api, FinalsInjuryEntry, Game, LadderRow } from "../lib/api";
import { buildFinalsBracket, FINALS_ROUNDS, teamsAliveInFinals } from "../lib/finalsBracket";
import FinalsBracketView from "../components/FinalsBracketView";
import FinalsInjuryWatch from "../components/FinalsInjuryWatch";
import FinalsPredictor from "../components/FinalsPredictor";
import PageHero from "../components/ui/PageHero";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export default function FinalsPage() {
  const location = useLocation();
  const [ladderRows, setLadderRows] = useState<LadderRow[] | null>(null);
  const [games, setGames] = useState<Game[] | null>(null);
  const [injuries, setInjuries] = useState<FinalsInjuryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL Finals Hub",
    description: "The NRL finals bracket, a live predictor, and a finals-only injury watch — all in one place.",
    path: "/finals",
  });

  useEffect(() => {
    api
      .getLadder()
      .then((l) => setLadderRows(l.rows))
      .catch((err) => setError(err.message));
    // One request per finals round rather than fetching everything and
    // filtering client-side — Grand Final games in particular could span
    // multiple seasons over time, and this keeps the payload to just what
    // the bracket needs.
    Promise.all(FINALS_ROUNDS.map((round) => api.listGames(round)))
      .then((results) => setGames(results.flat()))
      .catch((err) => setError(err.message));
    api.listFinalsInjuries().then(setInjuries).catch(() => setInjuries([]));
  }, []);

  const top8 = useMemo(() => ladderRows?.filter((r) => r.rank <= 8).sort((a, b) => a.rank - b.rank) ?? null, [ladderRows]);

  const top8Ranks = useMemo(() => new Map((top8 ?? []).map((r) => [r.team.id, r.rank])), [top8]);

  const bracket = useMemo(() => (top8 && games ? buildFinalsBracket(top8, games) : null), [top8, games]);

  const aliveTeams = useMemo(() => (top8 && games ? teamsAliveInFinals(top8, games) : []), [top8, games]);

  const loading = !top8 || !games || !bracket;

  // The Home widget deep-links to /finals#injury-watch, at the bottom of the
  // page — this is an SPA route change (no full page load), so there's no
  // browser-native hash-scroll to rely on; this effect does it manually.
  // Waits on `!loading` (Bracket/Predictor's own data), not just `injuries` —
  // those two sections sit *above* Injury Watch and each render a skeleton
  // until their own fetch resolves. Scrolling as soon as injuries alone
  // loaded (its fetch is a single request, so it often wins the race) meant
  // scrolling into position while the sections above were still short
  // skeletons, then watching them expand to full height right after and
  // push the anchor back down past the viewport — the scroll technically
  // ran, it just got undone by a layout shift a moment later. Waiting for
  // every section to reach final height first means nothing shifts under
  // the scroll afterward.
  useEffect(() => {
    if (location.hash === "#injury-watch" && injuries && !loading) {
      document.getElementById("injury-watch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, injuries, loading]);

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-8">
      <PageHero
        eyebrow="Finals 2026"
        title="Finals Hub"
        subtitle="The bracket, your predictions, and who's fit for finals — all in one place."
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase mb-3">Bracket</h2>
        {loading ? <FeedSkeleton count={4} /> : <FinalsBracketView bracket={bracket} top8Ranks={top8Ranks} />}
      </section>

      <section>
        <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase mb-1">Predictor</h2>
        <p className="text-[12.5px] text-slate-500 mb-3">
          Pick a winner for each matchup — your picks carry through to the next round automatically.
        </p>
        {loading ? <FeedSkeleton count={4} /> : <FinalsPredictor top8={top8} realBracket={bracket} />}
      </section>

      <section id="injury-watch">
        <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase mb-3">Injury Watch</h2>
        {loading || !injuries ? (
          <FeedSkeleton count={3} />
        ) : (
          <FinalsInjuryWatch entries={injuries} aliveTeams={aliveTeams} />
        )}
      </section>
    </div>
  );
}
