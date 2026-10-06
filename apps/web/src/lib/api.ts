import { getVisitorId, isOwnDevice } from "./visitor";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // Content-Type only when there's a body: on a cross-origin GET (the site
    // and the app both call the API on another domain) that header alone
    // makes the browser send a CORS preflight first — an extra round trip
    // to the API before every read.
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface TweetMedia {
  type: "photo" | "video" | "animated_gif";
  url: string;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
}

// One move in the signings tracker (see the API's Transfer model).
export type TransferKind = "SIGNED" | "RE_SIGNED" | "RELEASED" | "RETIRED";
export type TransferTeam = Pick<Team, "id" | "name" | "shortName" | "slug" | "primaryColor">;
export interface Transfer {
  id: string;
  player: string;
  kind: TransferKind;
  fromTeam: TransferTeam | null;
  toTeam: TransferTeam | null;
  fromLabel: string | null;
  toLabel: string | null;
  contractUntil: number | null;
  announcedAt: string;
  event: {
    id: string;
    headline: string;
    sourceUrl: string | null;
    sourceName: string | null;
    slug: string | null;
    isOriginalArticle: boolean;
  } | null;
}

// A men's Rugby League World Cup game (the API's WorldCupMatch).
export interface WorldCupMatch {
  id: string;
  roundName: string;
  pool: "A" | "B" | null;
  kickoffAt: string;
  venue: string;
  city: string;
  homeName: string;
  homeAbbr: string;
  awayName: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "SCHEDULED" | "LIVE" | "FULL_TIME";
  matchCentreUrl: string | null;
  ticketUrl: string | null;
}

export interface WorldCupSquad {
  abbr: string;
  name: string;
  players: { name: string; club?: string; captain?: boolean; debutant?: boolean }[];
  shadows: string[] | null;
  note: string | null;
  announcedAt: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface EventItem {
  id: string;
  type: "INJURY" | "LINEUP_CHANGE" | "NEWS" | "TRANSFER" | "GENERAL_NEWS" | "SOCIAL_POST";
  headline: string;
  body: string;
  newStatus: string | null;
  teamListStage: "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL" | null;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceAuthor: string | null;
  embedHtml: string | null;
  // SOCIAL_POST only — the tweet's photos/videos (see the API's
  // lib/tweetMedia.ts). Absent/null when the post has none.
  media?: TweetMedia[] | null;
  // A Rugby League World Cup story (also on /world-cup).
  worldCup?: boolean;
  // A World Cup team list's game (see /world-cup/:id).
  worldCupMatchId?: string | null;
  createdAt: string;
  // A Full Set-authored article — renders at /news/:slug inside the app
  // instead of linking out via sourceUrl (see schema.prisma design note).
  isOriginalArticle: boolean;
  slug: string | null;
  // Only present on the single-article response (api.getArticle), not on
  // any feed/list response — see routes/articles.ts and routes/feed.ts's
  // deliberately lean include list.
  articleBody?: string | null;
  player?: { id: string; name: string; slug: string } | null;
  team?: { id: string; name: string; slug: string } | null;
  game?: {
    id: string;
    round: string;
    homeTeam: { shortName: string; slug: string };
    awayTeam: { shortName: string; slug: string };
  } | null;
}

export interface Game {
  id: string;
  round: string;
  kickoffAt: string;
  venue: string | null;
  homeTeam: Team;
  awayTeam: Team;
  status: "SCHEDULED" | "LIVE" | "FULL_TIME";
  homeScore: number | null;
  awayScore: number | null;
  liveClock: string | null;
  liveScoreUpdatedAt: string | null;
  weatherFlag: boolean;
  weatherNote: string | null;
}

export interface TryScorer {
  id: string;
  scorer: string;
  minute: number;
}

export interface TeamListStages {
  INITIAL: EventItem | null;
  TWENTY_FOUR_HOUR: EventItem | null;
  FINAL: EventItem | null;
}

export interface RoundLineups {
  round: string | null;
  games: {
    game: Game;
    homeTeamLineup: TeamListStages;
    awayTeamLineup: TeamListStages;
  }[];
}

export interface GameDetail {
  game: Game;
  homeTeamLineup: TeamListStages;
  awayTeamLineup: TeamListStages;
  recentEvents: EventItem[];
  socialPosts: EventItem[];
  homeTries: TryScorer[];
  awayTries: TryScorer[];
}

export interface Episode {
  id: string;
  title: string;
  description: string | null;
  audioUrl: string;
  transcriptAudioUrl: string | null;
  publishedAt: string | null;
  durationSeconds: number | null;
  transcriptStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  transcriptError: string | null;
  podcast: { name: string; slug: string };
}

export interface Podcast {
  id: string;
  name: string;
  slug: string;
  rssUrl: string;
  description: string | null;
  artworkUrl: string | null;
}

export interface Player {
  id: string;
  name: string;
  slug: string;
  position: string | null;
  jerseyNumber: number | null;
  photoUrl: string | null;
  currentStatus: string;
  currentStatusNote: string | null;
  statusUpdatedAt: string | null;
}

export interface InjuredPlayer extends Player {
  team: Team;
}

export interface LadderRow {
  rank: number;
  team: { id: string; name: string; shortName: string; slug: string; primaryColor: string | null };
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDifferential: number;
  competitionPoints: number;
  /** Last-5 results, oldest to newest, one char per game ('W'/'L'/'D'); null until the admin enters it. */
  form: string | null;
  /** Vs. the rank snapshotted right before the most recent ladder update — null until there's a prior snapshot to compare against. */
  movement: "up" | "down" | "same" | null;
}

export interface Ladder {
  /** The round these standings reflect — set explicitly by the admin, not derived (byes make max(played) unreliable). */
  asOfRound: number | null;
  /** True while asOfRound's fixtures are still being played out (mid-round results) — false once the round is fully complete. */
  roundInProgress: boolean;
  rows: LadderRow[];
}

export interface JudiciaryCharge {
  id: string;
  round: string;
  player: string;
  team: Team;
  charge: string;
  grade: string;
  result: string;
  matchesToServe: number | null;
  financialPenalty: number | null;
  createdAt: string;
}

export type FinalsInjuryStatus = "OUT" | "LIKELY" | "UNLIKELY" | "TBA" | "TBC";

export interface FinalsInjuryEntry {
  id: string;
  team: Team;
  player: string;
  injury: string;
  status: FinalsInjuryStatus;
  updatedAt: string;
}

export interface LateMailPlayer {
  number: number;
  name: string;
  position: string;
}

export interface LateMailTeamSheet {
  rawTeamName: string;
  matchedTeamId: string | null;
  matchedTeamName: string | null;
  matchedGameId: string | null;
  starters: LateMailPlayer[];
  interchange: LateMailPlayer[];
  reserves: LateMailPlayer[];
  shapeWarnings: string[];
  suggestedStage: "INITIAL" | "TWENTY_FOUR_HOUR" | "FINAL";
  generatedBody: string;
}

export interface LateMailMatch {
  matchLabel: string;
  home: LateMailTeamSheet;
  away: LateMailTeamSheet;
}

export interface LateMailResult {
  round: string | null;
  sourceUrl: string;
  narrative: string;
  matches: LateMailMatch[];
}

export interface SearchResult {
  kind: "transcript" | "chapter" | "episode";
  podcast: string;
  episodeTitle: string;
  url: string;
  startSeconds: number | null;
  snippet: string;
  publishedAt: string | null;
}

export interface TrackedShow {
  id: string;
  name: string;
  youtubeChannelId: string | null;
  spotifyShowId: string | null;
  createdAt: string;
  _count: { episodes: number };
}

export interface AdminStats {
  follows: {
    byTeam: { teamId: string; name: string; shortName: string; followerCount: number }[];
    generalNewsFollowerCount: number;
  };
  notificationOptIns: { total: number };
  visitors: { last7Days: number; last30Days: number; byDay: { day: string; visitors: number; views: number }[] };
  pageViews: { byPage: { page: string; total: number; last7Days: number }[] };
}

export const api = {
  listTeams: () => request<Team[]>("/teams"),
  listInjuries: () => request<InjuredPlayer[]>("/injuries"),
  getTeamBrief: (slug: string) =>
    request<{
      team: Team;
      players: Player[];
      currentGame: Game | null;
      lineupStages: TeamListStages | null;
      lastGame: Game | null;
      nextFixture: Game | null;
      recentEvents: EventItem[];
      socialPosts: EventItem[];
    }>(`/teams/${slug}`),
  getFeed: (limit?: number) => request<EventItem[]>(`/feed${limit ? `?limit=${limit}` : ""}`),
  listSocialPosts: () => request<EventItem[]>(`/social`),
  getArticle: (slug: string) => request<EventItem>(`/articles/${slug}`),
  listWorldCupMatches: () => request<WorldCupMatch[]>("/world-cup/matches"),
  listWorldCupSquads: () => request<WorldCupSquad[]>("/world-cup/squads"),
  getWorldCupMatch: (id: string) =>
    request<{ match: WorldCupMatch; home: TeamListStages; away: TeamListStages }>(`/world-cup/matches/${id}`),
  listTransfers: (opts: { team?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.team) q.set("team", opts.team);
    if (opts.limit) q.set("limit", String(opts.limit));
    const qs = q.toString();
    return request<Transfer[]>(`/transfers${qs ? `?${qs}` : ""}`);
  },
  listGames: (round?: string) => request<Game[]>(`/games${round ? `?round=${encodeURIComponent(round)}` : ""}`),
  listRounds: () => request<string[]>("/games/rounds"),
  getGame: (id: string) => request<GameDetail>(`/games/${id}`),
  getCurrentRoundLineups: () => request<RoundLineups>("/games/current-round"),
  listPodcasts: () => request<Podcast[]>("/podcasts"),
  listEpisodesBrowse: () => request<Episode[]>("/podcasts/episodes"),
  search: (q: string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
  getTrendingTopic: () => request<{ topic: string | null }>(`/search/trending`),
  follow: (fcmToken: string, targetType: "TEAM" | "PLAYER" | "LEAGUE", targetId: string) =>
    request(`/follows`, { method: "POST", body: JSON.stringify({ fcmToken, targetType, targetId }) }),
  unfollow: (id: string) => request(`/follows/${id}`, { method: "DELETE" }),
  myFollows: (fcmToken: string) => request<{ id: string; targetType: string; targetId: string }[]>(`/follows/${fcmToken}`),
  adminLogin: (email: string, password: string) =>
    request<{ token: string }>(`/admin/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) }),
  adminListEvents: (token: string) =>
    request<EventItem[]>(`/admin/events`, { headers: { Authorization: `Bearer ${token}` } }),
  adminCreateEvent: (
    token: string,
    data: {
      type: string;
      teamId?: string;
      playerId?: string;
      gameId?: string;
      headline: string;
      body: string;
      newStatus?: string;
      teamListStage?: string;
      sourceUrl?: string;
      sourceName?: string;
      sourceAuthor?: string;
      isOriginalArticle?: boolean;
      articleBody?: string;
    }
  ) =>
    request(`/admin/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminParseLateMail: (token: string, url?: string) =>
    request<LateMailResult>(`/admin/late-mail/parse`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    }),
  adminRegisterAlerts: (token: string, fcmToken: string) =>
    request<{ ok: boolean; devices: number }>(`/admin/alerts/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fcmToken }),
    }),
  adminTestAlert: (token: string) =>
    request<{ sent: number; failed: number }>(`/admin/alerts/test`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  adminUpdateEvent: (token: string, id: string, data: { headline?: string; body?: string; teamId?: string }) =>
    request<EventItem>(`/admin/events/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminCreateGame: (
    token: string,
    data: { homeTeamId: string; awayTeamId: string; round: string; kickoffAt: string; venue?: string }
  ) =>
    request<Game>(`/admin/games`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminSetGameResult: (
    token: string,
    gameId: string,
    data: {
      homeScore: number;
      awayScore: number;
      homeTries: { scorer: string; minute: number }[];
      awayTries: { scorer: string; minute: number }[];
    }
  ) =>
    request<Game>(`/admin/games/${gameId}/result`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminSetLiveScore: (token: string, gameId: string, data: { homeScore: number; awayScore: number; liveClock?: string }) =>
    request<Game>(`/admin/games/${gameId}/live-score`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminSetGameWeather: (token: string, gameId: string, data: { weatherFlag: boolean; weatherNote?: string }) =>
    request<Game>(`/admin/games/${gameId}/weather`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminCreateEpisode: (
    token: string,
    data: {
      podcastId: string;
      title: string;
      description?: string;
      audioUrl: string;
      transcriptAudioUrl?: string;
      publishedAt?: string;
      durationSeconds?: number;
    }
  ) =>
    request<Episode>(`/admin/episodes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminDeleteEpisode: (token: string, id: string) =>
    request(`/admin/episodes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  adminTranscribeEpisode: (token: string, id: string) =>
    request(`/admin/episodes/${id}/transcribe`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  adminListTrackedShows: (token: string) =>
    request<TrackedShow[]>(`/admin/tracked-shows`, { headers: { Authorization: `Bearer ${token}` } }),
  adminCreateTrackedShow: (
    token: string,
    data: { name: string; youtubeChannelId?: string; spotifyShowId?: string }
  ) =>
    request<TrackedShow & { episodesIndexed: number }>(`/admin/tracked-shows`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminDeleteTrackedShow: (token: string, id: string) =>
    request(`/admin/tracked-shows/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  adminCreatePlayer: (
    token: string,
    data: { teamId: string; name: string; position?: string; jerseyNumber?: number }
  ) =>
    request<Player>(`/admin/players`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminDeletePlayer: (token: string, id: string) =>
    request(`/admin/players/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  adminBulkCreatePlayers: (
    token: string,
    data: { teamId: string; players: { name: string; position?: string; jerseyNumber?: number }[] }
  ) =>
    request<{ created: number; players: Player[] }>(`/admin/players/bulk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  // Skipped entirely on the owner's own devices (see lib/visitor.ts).
  trackPageView: async (
    page: "home" | "news" | "teams" | "games" | "team-lists" | "social" | "podcasts" | "ladder" | "highlights" | "judiciary"
  ) => {
    if (isOwnDevice()) return;
    const visitorId = getVisitorId();
    await request(`/pageviews`, { method: "POST", body: JSON.stringify(visitorId ? { page, visitorId } : { page }) });
  },
  adminGetStats: (token: string) =>
    request<AdminStats>(`/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
  getLadder: () => request<Ladder>(`/ladder`),
  listJudiciary: (round?: string) =>
    request<JudiciaryCharge[]>(`/judiciary${round ? `?round=${encodeURIComponent(round)}` : ""}`),
  listJudiciaryRounds: () => request<string[]>("/judiciary/rounds"),
  adminSetJudiciary: (
    token: string,
    data: {
      round: string;
      charges: {
        player: string;
        teamId: string;
        charge: string;
        grade: string;
        result: string;
        matchesToServe?: number;
        financialPenalty?: number;
      }[];
    }
  ) =>
    request<JudiciaryCharge[]>(`/admin/judiciary`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  listFinalsInjuries: () => request<FinalsInjuryEntry[]>(`/finals-injuries`),
  adminSetFinalsInjuries: (
    token: string,
    data: { entries: { teamId: string; player: string; injury: string; status: FinalsInjuryStatus }[] }
  ) =>
    request<FinalsInjuryEntry[]>(`/admin/finals-injuries`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
  adminUpdateLadder: (
    token: string,
    data: {
      asOfRound: number;
      roundInProgress?: boolean;
      rows: {
        teamId: string;
        played: number;
        wins: number;
        losses: number;
        draws: number;
        pointsFor: number;
        pointsAgainst: number;
        competitionPoints: number;
        form?: string;
      }[];
    }
  ) =>
    request(`/admin/ladder`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};
