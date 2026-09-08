import { useEffect, useRef } from "react";

// Runs `callback` on a fixed timer for as long as the component is mounted —
// callers decide per-tick whether there's actually anything worth fetching
// (see needsLivePolling below), so this stays a dumb, always-on ticker
// rather than something that has to be re-subscribed every time "should I
// be polling" changes. The ref indirection means callers don't need to
// memoize `callback` or list it in any dependency array — each tick always
// runs whatever the latest render passed in.
export function usePolling(callback: () => void, intervalMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const id = setInterval(() => callbackRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

const PRE_KICKOFF_WINDOW_MS = 15 * 60 * 1000;

// Mirrors the API's own liveScorePoller.ts "in window" idea, loosely: a
// SCHEDULED game is worth polling once kickoff is close enough that it
// could go LIVE any moment, and a LIVE game always is (see schema.prisma's
// GameStatus note — a LIVE game keeps its original, now-past kickoffAt, so
// there's no "too long ago" cutoff to apply here on the client). FULL_TIME
// has nothing left to change, ever.
export function needsLivePolling(game: { status: string; kickoffAt: string } | null | undefined): boolean {
  if (!game) return false;
  if (game.status === "LIVE") return true;
  if (game.status === "SCHEDULED") {
    return new Date(game.kickoffAt).getTime() - Date.now() < PRE_KICKOFF_WINDOW_MS;
  }
  return false;
}
