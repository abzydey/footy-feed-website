import { getToken, onMessage } from "firebase/messaging";

import { api } from "./api";
import { getFirebaseMessaging, isFirebaseConfigured } from "./firebase";

const FCM_TOKEN_KEY = "footy-feed:fcmToken";

// Registers the service worker on every page load, not just when someone
// opts into push — Chrome's automatic install prompt (the beforeinstallprompt
// banner, as opposed to the manual "Install app" menu item) still requires a
// registered service worker with a real fetch handler, so gating
// registration behind the notification flow meant almost nobody ever saw
// that banner. navigator.serviceWorker.register() is idempotent for the
// same script URL — calling it again later from enablePushNotifications()
// just resolves the existing registration, it doesn't re-register or
// conflict.
export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | undefined {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

export function getStoredFcmToken(): string | null {
  return localStorage.getItem(FCM_TOKEN_KEY);
}

// iOS Safari (and every other iOS browser, since they're all WebKit under
// the hood) only exposes the Push API to a site running as an installed
// Home Screen web app — calling Notification.requestPermission() from a
// regular tab just silently fails or no-ops, with no prompt and no error.
// Detecting this upfront means we can tell someone what to actually do
// instead of letting them hit that dead end and go hunting through Safari
// settings themselves. No feature-detection API exists for "is this iOS
// Safari" — user-agent sniffing is the standard, if inelegant, approach
// every push-notification vendor uses for this exact check.
export function needsIosHomeScreenInstall(): boolean {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  if (!isIos) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

/**
 * Asks the browser for notification permission and registers this
 * device/browser with Firebase Cloud Messaging. Works on desktop Chrome/
 * Firefox/Edge, Android Chrome, and iOS Safari 16.4+ (only when the site has
 * been "Added to Home Screen" — that's an iOS/Safari PWA requirement, not
 * something this code can work around).
 *
 * Returns the FCM token on success, or null if push isn't supported/denied/
 * not configured yet.
 */
export async function enablePushNotifications(): Promise<string | null> {
  if (!isFirebaseConfigured) {
    console.warn("Firebase not configured — set VITE_FIREBASE_* env vars to enable push.");
    return null;
  }
  if (!("Notification" in window)) return null;

  // Only prompt when permission genuinely hasn't been decided yet.
  // Notification.requestPermission() technically re-resolves with the
  // current value either way, but reading Notification.permission directly
  // first means a permission already granted via the browser's own site
  // settings (bypassing our button entirely) is picked up immediately,
  // without depending on requestPermission()'s behavior in that case.
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  const messaging = getFirebaseMessaging();
  if (!messaging) return null;

  // getToken() can throw (blocked push service, stale service worker
  // registration, VAPID key mismatch, etc.) — previously uncaught here,
  // which for most failures would surface as the Firebase SDK's own error
  // message. But a browser that silently fails registration (some Android
  // Chrome + push-service edge cases) can leave this rejecting with a
  // generic/unhelpful error too, so log the real cause either way instead
  // of only ever showing the caller's own generic fallback message.
  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) localStorage.setItem(FCM_TOKEN_KEY, token);
    return token ?? null;
  } catch (err) {
    console.error("[push] enablePushNotifications failed after permission was granted:", err);
    return null;
  }
}

/** Follow a team, player, or the general NRL news category — requesting push permission first if needed. */
export async function followTarget(targetType: "TEAM" | "PLAYER" | "LEAGUE", targetId: string) {
  if (needsIosHomeScreenInstall()) {
    throw new Error('Add Full Set to your Home Screen first — tap Share, then "Add to Home Screen" — then come back here to enable notifications.');
  }

  let token = getStoredFcmToken();
  if (!token) {
    token = await enablePushNotifications();
  }
  if (!token) {
    // Notification.permission is checked directly here (not just whether we
    // have a cached token) so the message reflects reality: if permission is
    // already granted, the real failure is upstream (Firebase/service worker
    // — now logged to the console by enablePushNotifications) and telling
    // someone to "enable notifications" when they already have is actively
    // wrong, not just unhelpful.
    const permission = "Notification" in window ? Notification.permission : "denied";
    throw new Error(
      permission === "granted"
        ? "Notifications are enabled, but something went wrong setting them up. Please try again."
        : "Enable notifications in your browser to follow this."
    );
  }
  return api.follow(token, targetType, targetId);
}

/** Handle a push notification that arrives while the tab is open/focused. */
export function onForegroundMessage(callback: (title: string, body: string) => void) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload.notification?.title ?? "Full Set", payload.notification?.body ?? "");
  });
}
