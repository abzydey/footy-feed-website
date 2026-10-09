import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, EventItem } from "../lib/api";
import { dedupeStories, readCachedFeed, writeCachedFeed } from "../lib/feed";
import HeadlineList from "../components/HeadlineList";
import FinalsInjuryHomeCard from "../components/FinalsInjuryHomeCard";
import LatestEpisodeTeaser from "../components/LatestEpisodeTeaser";
import NextGameCard from "../components/NextGameCard";
import ScoreStrip from "../components/ScoreStrip";
import SigningsHomeCard from "../components/SigningsHomeCard";
import WorldCupHomeCard from "../components/WorldCupHomeCard";
import WorldCupSquadsCard from "../components/WorldCupSquadsCard";
import TeamListsCard from "../components/TeamListsCard";
import WhatsBeenSaidTeaser from "../components/WhatsBeenSaidTeaser";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useRefreshTick } from "../lib/refresh";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// How many stories Home previews before "All news" — the full list lives
// on the News page.
const LATEST_COUNT = 8;

export default function HomePage() {
  const [feed, setFeed] = useState<EventItem[] | null>(readCachedFeed);
  const [error, setError] = useState<string | null>(null);
  const refreshTick = useRefreshTick();

  useDocumentMeta({
    title: "NRL News, Team Lists & Ladder",
    description:
      "Your team. The full set. Real-time NRL news, official team lists, injury updates, fixtures, and ladder standings — one page per club.",
    path: "/",
  });

  useEffect(() => {
    api
      .getFeed()
      .then((fresh) => {
        setFeed(fresh);
        setError(null);
        writeCachedFeed(fresh);
      })
      .catch((err) => setError(err.message));
  }, [refreshTick]);

  // A fixed top-stories preview, not chip-driven anymore — the pills above
  // navigate away now, so there's no "selected filter" left to drive this
  // section. Full "Top"/"My Teams"/"Signing News" browsing lives on
  // FeedPage; this is just a taste of it right on Home.
  const articles = feed ? dedupeStories(feed).slice(0, LATEST_COUNT) : null;

  // One list of sections, two arrangements. Phones: a single column, in
  // this order — scores, the match cards, the latest headlines, then the
  // rest. Computers (lg): the score strip across the top, the match cards
  // and headlines down the wider left column, the rest in a right-hand
  // column — CSS grid placement only, so nothing renders (or fetches) twice.
  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto p-4 lg:px-5 lg:pt-7 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      <div className="lg:col-span-2 lg:row-start-1">
        <ScoreStrip />
      </div>

      <div className="lg:col-span-2 lg:row-start-2 space-y-5">
        <NextGameCard />
        {/* Only while the World Cup is on — renders nothing otherwise. */}
        <WorldCupHomeCard />
      </div>

      <section className="lg:col-span-2 lg:row-start-3">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">Latest</h2>
          <Link to="/news" className="text-[13px] font-bold text-brand-violet hover:text-brand-hover">
            All news →
          </Link>
        </div>

        {error && !feed && <p className="text-red-400 text-sm">{error}</p>}
        {!feed && !error && <FeedSkeleton count={4} />}
        {articles && articles.length === 0 && (
          <p className="text-[13.5px] font-semibold text-white/50 text-center mt-6">No stories yet.</p>
        )}
        {/* Headlines only (the full cards are on the News page), so Home
            shows eight stories in the space two cards used to take. */}
        {articles && articles.length > 0 && <HeadlineList items={articles} />}
      </section>

      <div className="space-y-5 lg:space-y-4 lg:col-start-3 lg:row-start-1 lg:row-span-3">
        <TeamListsCard />
        {/* World Cup only — the same quick-link row, for squads. */}
        <WorldCupSquadsCard />
        {/* Finals-only — renders nothing outside the finals window. */}
        <FinalsInjuryHomeCard />
        <SigningsHomeCard />
        <WhatsBeenSaidTeaser />
        <LatestEpisodeTeaser />
      </div>
    </div>
  );
}
