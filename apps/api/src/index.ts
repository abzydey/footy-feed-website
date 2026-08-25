import "dotenv/config";
import cors from "cors";
import express from "express";

import adminAuthRouter from "./routes/adminAuth";
import teamsRouter from "./routes/teams";
import eventsRouter from "./routes/events";
import followsRouter from "./routes/follows";
import podcastsRouter from "./routes/podcasts";
import searchRouter from "./routes/search";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "footy-feed-api" });
});

// Fan-facing read endpoints — team pages only for Phase 1 (no standalone
// player pages yet; player status/news surfaces inline on the team page).
app.use("/api/teams", teamsRouter);
app.use("/api/follows", followsRouter);
app.use("/api/podcasts", podcastsRouter);
app.use("/api/search", searchRouter);

// Admin panel (auth + write endpoints for events feed the brief pages + alerts)
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/events", eventsRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Footy Feed API listening on http://localhost:${port}`);
});
