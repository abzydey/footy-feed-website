import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

// Mirrors apps/web/src/lib/firebase.ts's isFirebaseConfigured pattern: this
// degrades gracefully to "not configured" until FIREBASE_SERVICE_ACCOUNT_JSON
// is set (see README "Alerts" section), so local dev without a Firebase
// project still works — notify.ts falls back to its console.log stub.
export const isFirebaseAdminConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

let messaging: Messaging | undefined;

export function getFirebaseMessaging(): Messaging | undefined {
  if (!isFirebaseAdminConfigured) return undefined;

  if (!messaging) {
    if (getApps().length === 0) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
      initializeApp({ credential: cert(serviceAccount) });
    }
    messaging = getMessaging();
  }
  return messaging;
}
