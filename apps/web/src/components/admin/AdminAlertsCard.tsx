import { useState } from "react";

import { api } from "../../lib/api";
import { enablePushNotifications, needsIosHomeScreenInstall } from "../../lib/push";

// Registers the current device for owner-only alerts (see api
// lib/adminAlert.ts) — e.g. the Late Mail poller finding no usable
// team-list article. Separate from fan follows: nothing here subscribes to
// team/league content.
export default function AdminAlertsCard({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "on" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function turnOn() {
    setStatus("working");
    setMessage(null);
    const fcmToken = await enablePushNotifications();
    if (!fcmToken) {
      setStatus("error");
      setMessage("Notifications weren't allowed on this device. Check the browser/app notification settings and try again.");
      return;
    }
    try {
      await api.adminRegisterAlerts(token, fcmToken);
      const result = await api.adminTestAlert(token);
      setStatus("on");
      setMessage(result.sent > 0 ? "Done — a test alert was just sent to this device." : "Registered, but the test alert didn't send. Tell Claude.");
    } catch {
      setStatus("error");
      setMessage("Couldn't register this device. Try logging out and back in.");
    }
  }

  if (needsIosHomeScreenInstall()) {
    return (
      <div className="rounded-xl bg-surface border border-white/10 p-4 text-sm text-slate-300">
        <p className="font-bold text-white mb-1">Admin alerts</p>
        On iPhone, open Full Set from your Home Screen first (Share → Add to Home Screen), then come back to this page to
        turn alerts on.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-white/10 p-4 text-sm text-slate-300 space-y-2">
      <p className="font-bold text-white">Admin alerts</p>
      <p>Get a push on this device if team lists stop updating automatically.</p>
      <button
        onClick={turnOn}
        disabled={status === "working"}
        className="bg-brand-violet hover:bg-brand-hover disabled:opacity-60 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]"
      >
        {status === "working" ? "Turning on…" : status === "on" ? "Send another test" : "Turn on admin alerts"}
      </button>
      {message && <p className={status === "error" ? "text-brand-siren" : "text-emerald-400"}>{message}</p>}
    </div>
  );
}
