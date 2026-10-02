// Sydney clock-time helpers. NRL times are Sydney times, and Sydney moves
// its clocks for daylight saving — so "the day before at the same time"
// isn't always exactly 24 hours earlier. (The 2026 Grand Final kicks off
// 7:30pm Sunday 4 Oct, the first day of daylight saving: 24 hours earlier
// is 6:30pm Saturday on the clock, but the 24-hour team list is due at
// 7:30pm Saturday.) Duplicated in apps/api/src/lib/sydneyTime.ts.

const SYDNEY = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// Sydney's offset from UTC at a moment, in ms (+10h or +11h).
function sydneyOffsetMs(t: number): number {
  const parts = SYDNEY.formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(t / 1000) * 1000;
}

// The same Sydney clock time one day earlier.
export function sameTimeDayBefore(t: number): number {
  const naive = t - 24 * 60 * 60 * 1000;
  return naive + (sydneyOffsetMs(t) - sydneyOffsetMs(naive));
}
