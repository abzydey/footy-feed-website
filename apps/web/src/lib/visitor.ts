// Anonymous visitor counting. Each browser (or the app on each phone) gets
// a random id the first time it loads a page, kept only in that browser's
// localStorage — no name, account, IP or device details. Page views carry
// it, so the admin stats can count people rather than page loads.
//
// A device where someone has logged into /admin is the site owner's own,
// so it stops being counted at all (see AdminPage).

const VISITOR_KEY = "fullset.visitorId";
const NO_TRACK_KEY = "fullset.noTrack";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older browsers: RFC 4122 v4 from Math.random — fine for an anonymous counter.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// null when storage is unavailable (private mode etc.) — the view is still
// counted, just not as a distinct person.
export function getVisitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function isOwnDevice(): boolean {
  try {
    return localStorage.getItem(NO_TRACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOwnDevice(): void {
  try {
    localStorage.setItem(NO_TRACK_KEY, "1");
  } catch {
    // storage blocked — nothing to do
  }
}
