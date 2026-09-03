const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
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
  createdAt: string;
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
  pageViews: { byPage: { page: string; total: number; last7Days: number }[] };
}

export const api = {
  listTeams: () => request<Team[]>("/teams"),
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
  getFeed: () => request<EventItem[]>(`/feed`),
  listSocialPosts: () => request<EventItem[]>(`/social`),
  listGames: (round?: string) => request<Game[]>(`/games${round ? `?round=${encodeURIComponent(round)}` : ""}`),
  listRounds: () => request<string[]>("/games/rounds"),
  getGame: (id: string) => request<GameDetail>(`/games/${id}`),
  getCurrentRoundLineups: () => request<RoundLineups>("/games/current-round"),
  listPodcasts: () => request<Podcast[]>("/podcasts"),
  listEpisodesBrowse: () => request<Episode[]>("/podcasts/episodes"),
  search: (q: string) => request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`),
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
    }
  ) =>
    request(`/admin/events`, {
      method: "POST",
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
  trackPageView: (page: "home" | "news" | "teams" | "games" | "team-lists" | "social" | "podcasts" | "ladder") =>
    request(`/pageviews`, { method: "POST", body: JSON.stringify({ page }) }),
  adminGetStats: (token: string) =>
    request<AdminStats>(`/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
  getLadder: () => request<Ladder>(`/ladder`),
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
