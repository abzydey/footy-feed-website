import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { api, EventItem } from "../lib/api";
import { dedupeStories } from "../lib/feed";
import EventCard from "../components/EventCard";
import LatestEpisodeTeaser from "../components/LatestEpisodeTeaser";
import NextGameCard from "../components/NextGameCard";
import TeamListsCard from "../components/TeamListsCard";
import WhatsBeenSaidTeaser from "../components/WhatsBeenSaidTeaser";
import { FeedSkeleton } from "../components/ui/Skeleton";
import { useDocumentMeta } from "../lib/useDocumentMeta";

// Pure navigation shortcuts, not in-place filters — each one takes you to
// its own full page (FeedPage for the first three, JudiciaryPage for the
// last). This used to be an in-place filter row (Top/My Teams/Signing News
// switching what rendered below, Ladder always navigating away as the odd
// one out) — confusing, because tapping a pill could change the highlighted
// state and the filtered content while both were off-screen, giving no
// visible confirmation anything happened. A real navigation removes that
// ambiguity outright, and it makes all four pills behave the same way
// instead of three of them being a special case. Judiciary replaced Ladder
// specifically because the regular season's over (a frozen ladder isn't a
// homepage priority) while Judiciary is a fully-built page that's
// especially relevant during finals — Ladder is still one tap away in the
// main nav either way.
const PILLS: { label: string; to: string }[] = [
  { label: "Top", to: "/feed/top" },
  { label: "My Teams", to: "/feed/my-teams" },
  { label: "Signing News", to: "/feed/signings" },
  { label: "Judiciary", to: "/judiciary" },
];

const pillClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 font-sans text-[12.5px] font-bold tracking-[.02em] px-3.5 py-2 rounded-full whitespace-nowrap transition-colors duration-150 border ${
    isActive
      ? "bg-brand-violet text-white border-transparent"
      : "bg-white/[.04] text-white/60 border-white/[.14] hover:text-white"
  }`;

export default function HomePage() {
  const [feed, setFeed] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDocumentMeta({
    title: "NRL News, Team Lists & Ladder",
    description:
      "Your team. The full set. Real-time NRL news, official team lists, injury updates, fixtures, and ladder standings — one page per club.",
    path: "/",
  });

  useEffect(() => {
    api.getFeed().then(setFeed).catch((err) => setError(err.message));
  }, []);

  // A fixed top-stories preview, not chip-driven anymore — the pills above
  // navigate away now, so there's no "selected filter" left to drive this
  // section. Full "Top"/"My Teams"/"Signing News" browsing lives on
  // FeedPage; this is just a taste of it right on Home.
  const articles = feed ? dedupeStories(feed) : null;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* The old hero tagline text lived here — dropped once the header's
          logo lockup (icon + FULLSET + "Your team. The full set.") started
          saying the exact same thing on every page, making a second copy on
          Home specifically redundant. Game card leads instead, right under
          the header, same spot the tagline used to occupy. */}
      <div className="pt-3 sm:pt-4">
        <NextGameCard />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {PILLS.map((p) => (
          <NavLink key={p.to} to={p.to} className={pillClass}>
            {p.label}
          </NavLink>
        ))}
      </div>

      <TeamListsCard />

      {/* Moved down from its old spot right under the header — still on
          Home, still one scroll away, just not the very first thing anyone
          sees ("not sure if i like it on the home page anymore but i still
          want people to see it"). */}
      <WhatsBeenSaidTeaser />

      {/* Same podcast-sourced family as the teaser above, styled as a
          matched-but-distinct pair — sits right before the news feed
          heading so News itself isn't pushed any further down. */}
      <LatestEpisodeTeaser />

      <div className="flex items-baseline justify-between">
        <h2 className="font-display font-bold text-xl tracking-[.06em] text-white uppercase">Latest</h2>
        {articles && <span className="text-[11.5px] font-semibold text-white/40">{articles.length} stories</span>}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!feed && !error && <FeedSkeleton count={5} />}
      {articles && articles.length === 0 && (
        <p className="text-[13.5px] font-semibold text-white/50 text-center mt-6">No stories yet.</p>
      )}
      {/* Horizontally-scrolling carousel rather than stacked cards — the
          full News page (GeneralNewsPage.tsx) keeps the vertical stack,
          this is Home-only so the news section doesn't push everything else
          below the fold. Same scroll-snap technique as NextGameCard's
          fixture carousel. Each card is wrapped rather than restyled so
          EventCard itself (shared with News/TeamPage) stays untouched — the
          wrapper just overrides the card's own mb-3 (meant for vertical
          stacking) since spacing here comes from the flex gap instead. */}
      {articles && articles.length > 0 && (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          {articles.map((event) => (
            <div key={event.id} className="snap-start shrink-0 w-[85%] sm:w-[380px] [&>article]:mb-0">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
