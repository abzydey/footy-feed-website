import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// True inside the iOS/Android app (Capacitor), false in any web browser.
// The app and the website share every page; this only gates the handful of
// app-only touches — tap vibration, pull to refresh, the footer living in
// the More sheet instead of at the bottom of every page.
export const isNativeApp = Capacitor.isNativePlatform();

// An installed Home Screen web app — no address bar, so /admin can't be
// typed (see Footer.tsx). The native app has the same problem.
export const isStandalone =
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true);

// A light tap, the same feel as switching tabs in a native iOS app. No-op
// on the web, and never throws — a missing vibration motor isn't an error.
export function tapHaptic(): void {
  if (!isNativeApp) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}
