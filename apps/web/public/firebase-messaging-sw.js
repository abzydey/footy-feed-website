// Background push handler. Runs as a service worker, so it can't use the
// npm `firebase` package's ESM build — it loads the compat SDK from
// Google's CDN instead. This is the standard pattern for FCM web push.
//
// NOTE: this file's Firebase config is filled in from the *build*, not read
// from .env at runtime (service workers can't read Vite env vars). The
// `npm run build` step in apps/web should substitute these placeholders —
// see README "Alerts" section for the exact deploy-time step. Until then,
// this file works fine in dev against a real Firebase project by pasting the
// same values used in apps/web/.env directly below.
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "__VITE_FIREBASE_API_KEY__",
  authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__VITE_FIREBASE_PROJECT_ID__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Footy Feed", {
    body: body ?? "",
    icon: "/icon-192.png",
  });
});
