import "dotenv/config";
import cors from "cors";
import express from "express";

import adminAuthRouter from "./routes/adminAuth";
import teamsRouter from "./routes/teams";
import gamesRouter from "./routes/games";
import eventsRouter from "./routes/events";
import followsRouter from "./routes/follows";
import podcastsRouter from "./routes/podcasts";
import searchRouter from "./routes/search";
import feedRouter from "./routes/feed";
import socialRouter from "./routes/social";
import adminGamesRouter from "./routes/adminGames";
import adminEpisodesRouter from "./routes/adminEpisodes";
import pageviewsRouter from "./routes/pageviews";
import adminStatsRouter from "./routes/adminStats";
import ladderRouter from "./routes/ladder";
import adminLadderRouter from "./routes/adminLadder";
import adminTrackedShowsRouter from "./routes/adminTrackedShows";
import adminPlayersRouter from "./routes/adminPlayers";
import { startTwitterPoller } from "./lib/socialPoller";
import { startPodcastDiscoveryPoller } from "./lib/podcastDiscoveryPoller";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "full-set-api" });
});

// Fan-facing read endpoints — team pages only for Phase 1 (no standalone
// player pages yet; player status/news surfaces inline on the team page).
app.use("/api/teams", teamsRouter);
app.use("/api/games", gamesRouter);
app.use("/api/follows", followsRouter);
app.use("/api/podcasts", podcastsRouter);
app.use("/api/search", searchRouter);
app.use("/api/feed", feedRouter);
app.use("/api/social", socialRouter);
app.use("/api/pageviews", pageviewsRouter);
app.use("/api/ladder", ladderRouter);

// Admin panel (auth + write endpoints for events feed the brief pages + alerts)
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/events", eventsRouter);
app.use("/api/admin/games", adminGamesRouter);
app.use("/api/admin/episodes", adminEpisodesRouter);
app.use("/api/admin/stats", adminStatsRouter);
app.use("/api/admin/ladder", adminLadderRouter);
app.use("/api/admin/tracked-shows", adminTrackedShowsRouter);
app.use("/api/admin/players", adminPlayersRouter);

// Railway sets PORT itself and its edge proxy expects the app bound to all
// interfaces, which app.listen(port, cb) already does by default (no host
// arg) — see README "Railway's per-service build/start commands" note for
// the other half of the Railway setup (the @full-set/api workspace name).
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Full Set API listening on http://localhost:${port}`);
  startTwitterPoller();
  startPodcastDiscoveryPoller();
});
