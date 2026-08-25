import { useState } from "react";

import { followTarget } from "../lib/push";

interface FollowButtonProps {
  targetType: "TEAM" | "PLAYER" | "LEAGUE";
  targetId: string;
  label?: string;
  followingLabel?: string;
  /** Tighter padding/text for use inside a grid tile (e.g. a squad card). */
  compact?: boolean;
}

export default function FollowButton({
  targetType,
  targetId,
  label = "Follow for alerts",
  followingLabel = "✓ Following",
  compact = false,
}: FollowButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "following" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setError(null);
    try {
      await followTarget(targetType, targetId);
      setState("following");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const sizeClasses = compact ? "text-xs px-2 py-1" : "text-sm px-4 py-2";

  if (state === "following") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-brand-violet text-white font-bold ${sizeClasses}`}>
        {followingLabel}
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className={`rounded-full border-2 border-brand-violet text-brand-violet font-bold hover:bg-brand-violet hover:text-white disabled:opacity-60 transition-colors ${sizeClasses}`}
      >
        {state === "loading" ? "Following…" : label}
      </button>
      {state === "error" && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
