import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { isNativeApp, tapHaptic } from "./platform";

// Pull to refresh, app only (browsers already have their own). A pull bumps
// a shared counter; anything that fetches data lists `useRefreshTick()` in
// its effect's dependencies and simply fetches again — keeping what it
// already shows until the new data lands, so nothing blanks out or jumps.
const RefreshContext = createContext<{ tick: number; refresh: () => void }>({ tick: 0, refresh: () => {} });

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return <RefreshContext.Provider value={{ tick, refresh }}>{children}</RefreshContext.Provider>;
}

export function useRefreshTick(): number {
  return useContext(RefreshContext).tick;
}

const TRIGGER_PX = 70; // how far to pull before letting go refreshes
const MAX_PX = 110;
const SPINNER_MS = 700; // long enough to read as "it refreshed"

// Watches touch drags that start at the very top of the page. Renders only
// the indicator — the page itself scrolls/bounces natively underneath.
export function PullToRefresh() {
  const { refresh } = useContext(RefreshContext);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    if (!isNativeApp) return;

    function onStart(e: TouchEvent) {
      startY.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null;
      armed.current = false;
    }
    function onMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Resistance, like iOS: the further you pull, the less it moves.
      const eased = Math.min(MAX_PX, dy * 0.55);
      pullRef.current = eased;
      setPull(eased);
      if (eased >= TRIGGER_PX && !armed.current) {
        armed.current = true;
        tapHaptic();
      } else if (eased < TRIGGER_PX) {
        armed.current = false;
      }
    }
    function onEnd() {
      if (startY.current == null) return;
      startY.current = null;
      if (pullRef.current >= TRIGGER_PX) {
        setBusy(true);
        refresh();
        window.setTimeout(() => setBusy(false), SPINNER_MS);
      }
      pullRef.current = 0;
      setPull(0);
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [busy, refresh]);

  if (!isNativeApp || (pull === 0 && !busy)) return null;

  const progress = busy ? 1 : Math.min(1, pull / TRIGGER_PX);
  return (
    <div
      aria-live="polite"
      className="fixed left-1/2 z-40 -translate-x-1/2 pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top) + ${busy ? 64 : 24 + pull * 0.4}px)` }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover border border-white/10 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.7)]"
        style={{ opacity: Math.max(0.25, progress) }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className={busy ? "animate-spin text-brand-violet" : progress >= 1 ? "text-brand-violet" : "text-slate-400"}
          style={busy ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M21 4v5h-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">{busy ? "Refreshing" : "Pull to refresh"}</span>
      </div>
    </div>
  );
}
