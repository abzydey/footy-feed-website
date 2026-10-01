import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const RESTORE_FOR_MS = 3000; // how long to keep trying while a page loads
const RETRY_MS = 50;

// Back/forward puts you where you were on that page; anything new opens at
// the top. React Router's own <ScrollRestoration> needs its data router,
// which this app doesn't use, so this is the same idea by hand.
//
// Positions are kept per history entry (location.key), so the same page
// opened twice remembers each visit separately. Most pages fetch their
// content after they open, so on a back navigation the page may not be
// tall enough yet — it keeps re-applying the position until it fits, gives
// up after a few seconds, and stops at once if the person starts scrolling.
export function useScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(new Map<string, number>());

  // Updated during render, i.e. before the new page is committed — so the
  // scroll event the browser fires when the old, longer page is swapped for
  // a shorter one is recorded against the new entry, never overwriting the
  // position saved for the page being left.
  const currentKey = useRef(location.key);
  currentKey.current = location.key;

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => positions.current.set(currentKey.current, window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useLayoutEffect(() => {
    // An #anchor link (e.g. /finals#injury-watch) is scrolled by its page.
    if (location.hash) return;

    const target = navType === "POP" ? positions.current.get(location.key) ?? 0 : 0;
    window.scrollTo(0, target);
    if (target <= 0) return;

    let stopped = false;
    let timer = 0;
    const started = Date.now();
    const stop = () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const attempt = () => {
      if (stopped) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, Math.min(target, max));
      if (max >= target || Date.now() - started > RESTORE_FOR_MS) return stop();
      timer = window.setTimeout(attempt, RETRY_MS);
    };
    attempt();
    return stop;
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
}
