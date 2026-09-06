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

// A real (if minimal) fetch handler — required for Chrome's automatic PWA
// install prompt, which specifically ignores a service worker with no
// fetch listener, or one that never calls respondWith(). This just passes
// requests straight to the network (no caching/offline behavior), so it
// changes nothing about how the app actually loads — it exists purely to
// satisfy that installability check.
//
// Scoped to same-origin GET requests only, and .catch()'d rather than left
// to reject: re-issuing EVERY request through the SW (POSTs, cross-origin
// embeds like the Twitter widget, requests the page itself later aborts)
// surfaced as "FetchEvent.respondWith received an error: TypeError: Load
// failed" in the console whenever one of those couldn't be replayed
// identically. Letting non-GET/cross-origin requests fall through
// untouched (no respondWith call at all) and returning Response.error()
// on a genuine failure avoids both the console noise and the risk of a
// user-visible failure that wasn't actually there without the SW.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Full Set", {
    body: body ?? "",
    icon: "/icon-192.png",
  });
});
