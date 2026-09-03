import { getToken, onMessage } from "firebase/messaging";

import { api } from "./api";
import { getFirebaseMessaging, isFirebaseConfigured } from "./firebase";

const FCM_TOKEN_KEY = "footy-feed:fcmToken";

export function getStoredFcmToken(): string | null {
  return localStorage.getItem(FCM_TOKEN_KEY);
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
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
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
