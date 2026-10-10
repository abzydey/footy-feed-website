import { lazy, Suspense, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { onForegroundMessage } from "./lib/push";
import { isNativeApp } from "./lib/platform";
import { PullToRefresh, RefreshProvider } from "./lib/refresh";
import { useScrollRestoration } from "./lib/scrollRestoration";
import { api } from "./lib/api";
import HomePage from "./pages/HomePage";

// Every page but Home loads on demand, so a first visit downloads only the
// app shell and the page it landed on — a much smaller first load (good for
// people on mobile data, and for search ranking, which scores load speed).
const FeedPage = lazy(() => import("./pages/FeedPage"));
const GeneralNewsPage = lazy(() => import("./pages/GeneralNewsPage"));
const NewsArticlePage = lazy(() => import("./pages/NewsArticlePage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const TeamListsPage = lazy(() => import("./pages/TeamListsPage"));
const LadderPage = lazy(() => import("./pages/LadderPage"));
const FinalsPage = lazy(() => import("./pages/FinalsPage"));
const JudiciaryPage = lazy(() => import("./pages/JudiciaryPage"));
const InjuriesPage = lazy(() => import("./pages/InjuriesPage"));
const SocialPage = lazy(() => import("./pages/SocialPage"));
const PodcastsPage = lazy(() => import("./pages/PodcastsPage"));
const HighlightsPage = lazy(() => import("./pages/HighlightsPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SigningsPage = lazy(() => import("./pages/SigningsPage"));
const StoryPage = lazy(() => import("./pages/StoryPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const WorldCupPage = lazy(() => import("./pages/WorldCupPage"));
const WorldCupMatchPage = lazy(() => import("./pages/WorldCupMatchPage"));
const WorldCupTeamsPage = lazy(() => import("./pages/WorldCupTeamsPage"));
const WorldCupNationPage = lazy(() => import("./pages/WorldCupNationPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));

// Maps a route to one of the small fixed set of page labels the backend
// tracks (see api/src/routes/pageviews.ts) — a team/game detail route counts
// under its section (e.g. "/teams/broncos" -> "teams"), not as its own
// label, matching prefixes ordered longest-first isn't needed since "/" is
// handled separately below. Routes not listed here (search, admin) are
// deliberately not tracked.
const PAGE_BY_PATH_PREFIX: [prefix: string, page: "news" | "teams" | "games" | "team-lists" | "ladder" | "social" | "podcasts" | "highlights" | "judiciary"][] = [
  // /feed/* (Top/My Teams/Signing News, formerly Home's in-place filter
  // chips) counts under the same "news" bucket the backend already tracks —
  // no new page label needed for what's conceptually still news browsing.
  ["/feed", "news"],
  ["/news", "news"],
  ["/teams", "teams"],
  ["/team-lists", "team-lists"],
  ["/games", "games"],
  ["/ladder", "ladder"],
  ["/social", "social"],
  ["/podcasts", "podcasts"],
  ["/highlights", "highlights"],
  ["/judiciary", "judiciary"],
];

function usePageViewTracking() {
  const location = useLocation();

  useEffect(() => {
    const page =
      location.pathname === "/"
        ? "home"
        : PAGE_BY_PATH_PREFIX.find(([prefix]) => location.pathname.startsWith(prefix))?.[1];
    if (page) {
      // Fire-and-forget — a tracking failure should never affect the page.
      api.trackPageView(page).catch(() => {});
    }
  }, [location.pathname]);
}

// Phase 1 scope: team pages only — no standalone player pages yet. A
// player's status/news still shows inline on their team's page (see
// TeamPage's squad section).
export default function App() {
  usePageViewTracking();
  useScrollRestoration();
  const location = useLocation();

  // FCM only auto-shows a system notification when the tab isn't focused
  // (handled by the service worker) — a foreground/open tab has to be
  // handled manually, otherwise a push arriving while someone's looking at
  // the app would silently do nothing.
  useEffect(() => {
    return onForegroundMessage((title, body) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icon-192.png" });
      }
    });
  }, []);

  return (
    <RefreshProvider>
      {/* Bottom padding keeps the phone tab bar (Nav.tsx) from covering the
          end of every page; computers have no tab bar. */}
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Nav />
        <PullToRefresh />
        {/* Keyed on the path so each page fades in, the way app screens do,
            instead of swapping instantly like web pages. */}
        <main key={location.pathname} className="animate-page-in">
          <Suspense fallback={null}>
          {/* New page? Add it to middleware.ts too (STATIC_META or a pattern),
              or search engines are told it doesn't exist (404). */}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/feed/:view" element={<FeedPage />} />
            <Route path="/news" element={<GeneralNewsPage />} />
            <Route path="/news/:slug" element={<NewsArticlePage />} />
          <Route path="/story/:id" element={<StoryPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:slug" element={<TeamPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/games/:id" element={<GamePage />} />
            <Route path="/team-lists" element={<TeamListsPage />} />
            <Route path="/ladder" element={<LadderPage />} />
            <Route path="/finals" element={<FinalsPage />} />
            <Route path="/social" element={<SocialPage />} />
            <Route path="/podcasts" element={<PodcastsPage />} />
            <Route path="/highlights" element={<HighlightsPage />} />
            <Route path="/judiciary" element={<JudiciaryPage />} />
            <Route path="/injuries" element={<InjuriesPage />} />
            <Route path="/search" element={<SearchPage />} />
          <Route path="/signings" element={<SigningsPage />} />
          <Route path="/world-cup" element={<WorldCupPage />} />
          <Route path="/world-cup/teams" element={<WorldCupTeamsPage />} />
          <Route path="/world-cup/teams/:abbr" element={<WorldCupNationPage />} />
          <Route path="/world-cup/:id" element={<WorldCupMatchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </main>
        {/* In the app the footer's About/partners/© live in the More sheet
            instead, on phone-sized screens (Nav.tsx). */}
        <Footer className={isNativeApp ? "hidden lg:block" : ""} />
      </div>
    </RefreshProvider>
  );
}
