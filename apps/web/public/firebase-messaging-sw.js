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
  apiKey: "AIzaSyCSmlGptlmqZDS8FPlWbC2G5lidiVEidr4",
  authDomain: "footy-feed-281c9.firebaseapp.com",
  projectId: "footy-feed-281c9",
  messagingSenderId: "1091380642325",
  appId: "1:1091380642325:web:f43b07fcfdbbb57a24441c",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Full Set", {
    body: body ?? "",
    icon: "/icon-192.png",
  });
});
