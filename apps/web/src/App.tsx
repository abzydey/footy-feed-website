import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import Nav from "./components/Nav";
import Footer from "./components/Footer";
import { onForegroundMessage } from "./lib/push";
import { api } from "./lib/api";
import HomePage from "./pages/HomePage";
import GeneralNewsPage from "./pages/GeneralNewsPage";
import TeamsPage from "./pages/TeamsPage";
import TeamPage from "./pages/TeamPage";
import GamesPage from "./pages/GamesPage";
import GamePage from "./pages/GamePage";
import TeamListsPage from "./pages/TeamListsPage";
import LadderPage from "./pages/LadderPage";
import JudiciaryPage from "./pages/JudiciaryPage";
import SocialPage from "./pages/SocialPage";
import PodcastsPage from "./pages/PodcastsPage";
import HighlightsPage from "./pages/HighlightsPage";
import SearchPage from "./pages/SearchPage";
import AboutPage from "./pages/AboutPage";
import AdminPage from "./pages/AdminPage";

// Maps a route to one of the small fixed set of page labels the backend
// tracks (see api/src/routes/pageviews.ts) — a team/game detail route counts
// under its section (e.g. "/teams/broncos" -> "teams"), not as its own
// label, matching prefixes ordered longest-first isn't needed since "/" is
// handled separately below. Routes not listed here (search, admin) are
// deliberately not tracked.
const PAGE_BY_PATH_PREFIX: [prefix: string, page: "news" | "teams" | "games" | "team-lists" | "ladder" | "social" | "podcasts" | "highlights" | "judiciary"][] = [
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
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/news" element={<GeneralNewsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:slug" element={<TeamPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:id" element={<GamePage />} />
          <Route path="/team-lists" element={<TeamListsPage />} />
          <Route path="/ladder" element={<LadderPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/podcasts" element={<PodcastsPage />} />
          <Route path="/highlights" element={<HighlightsPage />} />
          <Route path="/judiciary" element={<JudiciaryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
