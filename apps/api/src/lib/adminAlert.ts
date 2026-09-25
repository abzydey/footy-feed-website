import { prisma } from "./prisma";
import { getFirebaseMessaging } from "./firebase";

// Push alerts to the site owner's own devices when a background job is
// silently failing (e.g. the Late Mail poller reading a stale article) —
// logs alone weren't enough, the Preliminary Finals miss sat in Railway
// logs for days unseen. Deliberately separate from fan notifications
// (notify.ts / Follow / Subscriber): these tokens are registered from the
// auth-gated /admin page, never from a public follow button, and live in
// AppSetting as a JSON array rather than a new table.
const ADMIN_TOKENS_KEY = "admin.alertTokens";

async function getTokens(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: ADMIN_TOKENS_KEY } });
  return row ? (JSON.parse(row.value) as string[]) : [];
}

async function saveTokens(tokens: string[]): Promise<void> {
  const value = JSON.stringify(tokens);
  await prisma.appSetting.upsert({ where: { key: ADMIN_TOKENS_KEY }, create: { key: ADMIN_TOKENS_KEY, value }, update: { value } });
}

export async function registerAdminAlertToken(token: string): Promise<number> {
  const tokens = await getTokens();
  if (!tokens.includes(token)) tokens.push(token);
  await saveTokens(tokens);
  return tokens.length;
}

// Never throws — an alert failing must not break the job that raised it.
export async function sendAdminAlert(title: string, body: string): Promise<{ sent: number; failed: number }> {
  try {
    const tokens = await getTokens();
    const messaging = getFirebaseMessaging();
    if (tokens.length === 0 || !messaging) {
      console.warn(`[adminAlert] not sent (${tokens.length === 0 ? "no admin devices registered" : "Firebase not configured"}): ${title} — ${body}`);
      return { sent: 0, failed: 0 };
    }

    const response = await messaging.sendEachForMulticast({ tokens, notification: { title, body } });

    // Drop tokens Firebase says are dead (app reinstalled, notifications
    // revoked) so they don't pile up — only on the definitive "gone" codes,
    // not transient errors.
    const dead = response.responses
      .map((r, i) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code ?? "") ? tokens[i] : null))
      .filter((t): t is string => !!t);
    if (dead.length) await saveTokens(tokens.filter((t) => !dead.includes(t)));

    console.log(`[adminAlert] "${title}" sent to ${response.successCount}/${tokens.length} admin device(s)`);
    return { sent: response.successCount, failed: response.failureCount };
  } catch (err) {
    console.error("[adminAlert] failed:", err);
    return { sent: 0, failed: 0 };
  }
}
