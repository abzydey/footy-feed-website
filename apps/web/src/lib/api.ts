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
  type: "INJURY" | "LINEUP_CHANGE" | "NEWS" | "TRANSFER" | "GENERAL_NEWS";
  headline: string;
  body: string;
  newStatus: string | null;
  sourceUrl: string | null;
  createdAt: string;
  player?: { id: string; name: string; slug: string } | null;
  team?: { id: string; name: string; slug: string } | null;
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

export const api = {
  listTeams: () => request<Team[]>("/teams"),
  getTeamBrief: (slug: string) =>
    request<{ team: Team; players: Player[]; latestLineupChange: EventItem | null; recentEvents: EventItem[] }>(
      `/teams/${slug}`
    ),
  search: (q: string) =>
    request<
      {
        podcast: string;
        podcastSlug: string;
        episodeTitle: string;
        episodeId: string;
        audioUrl: string;
        startSeconds: number;
        snippet: string;
      }[]
    >(`/search?q=${encodeURIComponent(q)}`),
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
      headline: string;
      body: string;
      newStatus?: string;
      sourceUrl?: string;
    }
  ) =>
    request(`/admin/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),
};
