import { FormEvent, useState } from "react";

import { api } from "../lib/api";
import EventForm from "../components/admin/EventForm";
import GameForm from "../components/admin/GameForm";
import EpisodeForm from "../components/admin/EpisodeForm";
import StatsView from "../components/admin/StatsView";
import LadderForm from "../components/admin/LadderForm";
import TrackedShowsForm from "../components/admin/TrackedShowsForm";
import PlayerForm from "../components/admin/PlayerForm";

const TOKEN_KEY = "footy-feed:adminToken";
const TABS = ["Update", "Game", "Ladder", "Player", "Episode", "Shows", "Stats"] as const;

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  if (!token) return <LoginForm onLogin={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
  return <AdminTabs token={token} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(null); }} />;
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { token } = await api.adminLogin(email, password);
      onLogin(token);
    } catch (err) {
      setError("Login failed — check email/password.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-16 p-6 rounded-xl bg-surface border border-white/10 shadow-card space-y-3"
    >
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-white mb-2">Admin login</h1>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Password"
        className="w-full bg-black border border-white/20 px-3 py-2 text-white focus:outline-none focus:border-brand-violet focus:ring-1 focus:ring-brand-violet/50 transition-colors duration-150"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button className="w-full bg-brand-violet hover:bg-brand-violet/90 text-white font-bold px-4 py-2 transition-all duration-150 active:scale-[0.98]">
        Log in
      </button>
    </form>
  );
}

function AdminTabs({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Update");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-white">Admin</h1>
        <button onClick={onLogout} className="text-xs text-slate-400 hover:underline">
          Log out
        </button>
      </div>

      <div className="flex gap-4 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-bold tracking-tight border-b-2 transition-colors duration-150 ${
              tab === t ? "text-white border-brand-violet" : "text-slate-400 border-transparent hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Update" && <EventForm token={token} onLogout={onLogout} />}
      {tab === "Game" && <GameForm token={token} />}
      {tab === "Ladder" && <LadderForm token={token} />}
      {tab === "Player" && <PlayerForm token={token} />}
      {tab === "Episode" && <EpisodeForm token={token} />}
      {tab === "Shows" && <TrackedShowsForm token={token} />}
      {tab === "Stats" && <StatsView token={token} />}
    </div>
  );
}
