import { initializeApp, FirebaseApp } from "firebase/app";
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Push notifications are opt-in and depend on Firebase env vars that aren't
// set until someone creates a Firebase project (see README "Alerts" section).
// Everything in this file degrades gracefully to "unsupported" until then,
// so the rest of the app works fine without it configured.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | undefined;
let messaging: Messaging | undefined;

export function getFirebaseMessaging(): Messaging | undefined {
  if (!isFirebaseConfigured) return undefined;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;

  if (!app) app = initializeApp(firebaseConfig);
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}
