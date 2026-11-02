import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

// Mirrors apps/web/src/lib/firebase.ts's isFirebaseConfigured pattern: this
// degrades gracefully to "not configured" until FIREBASE_SERVICE_ACCOUNT_JSON
// is set (see README "Alerts" section), so local dev without a Firebase
// project still works — notify.ts falls back to its console.log stub.
export const isFirebaseAdminConfigured = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

let messaging: Messaging | undefined;

// Hosting dashboards can turn the private key's \n escapes into real line
// breaks when the value is pasted, which JSON.parse rejects. Puts them back,
// only inside strings, so a pretty-printed value still parses.
export function parseServiceAccount(raw: string) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString && !escaped && (ch === "\n" || ch === "\r")) {
      if (ch === "\n") out += "\\n";
      continue;
    }
    if (ch === '"' && !escaped) inString = !inString;
    escaped = inString && ch === "\\" && !escaped;
    out += ch;
  }
  return JSON.parse(out);
}

export function getFirebaseMessaging(): Messaging | undefined {
  if (!isFirebaseAdminConfigured) return undefined;

  if (!messaging) {
    if (getApps().length === 0) {
      const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
      initializeApp({ credential: cert(serviceAccount) });
    }
    messaging = getMessaging();
  }
  return messaging;
}
