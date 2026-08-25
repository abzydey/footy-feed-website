import { Route, Routes } from "react-router-dom";

import Nav from "./components/Nav";
import HomePage from "./pages/HomePage";
import TeamPage from "./pages/TeamPage";
import SearchPage from "./pages/SearchPage";
import AdminPage from "./pages/AdminPage";

// Phase 1 scope: team pages only — no standalone player pages yet. A
// player's status/news still shows inline on their team's page (see
// TeamPage's squad section).
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams/:slug" element={<TeamPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </>
  );
}
