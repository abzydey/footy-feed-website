import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, Transfer } from "../lib/api";
import { useRefreshTick } from "../lib/refresh";
import TransferRow from "./TransferRow";

const PREVIEW = 5;

// Home's window into the signings tracker: the latest few confirmed moves
// and a way into the full tracker. Shown all year — signings never really
// stop — but it's the main event once the season's over.
export default function SigningsHomeCard() {
  const [moves, setMoves] = useState<Transfer[] | null>(null);
  const refreshTick = useRefreshTick();

  useEffect(() => {
    api
      .listTransfers({ limit: PREVIEW })
      .then(setMoves)
      .catch(() => setMoves((prev) => prev ?? []));
  }, [refreshTick]);

  if (!moves || moves.length === 0) return null;

  return (
    <section className="bg-surface border border-white/[.07] rounded-[18px] px-4 pt-3.5 pb-1.5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-display font-bold text-[11px] tracking-[.14em] text-brand-violet uppercase">Signings tracker</h2>
        <Link to="/signings" className="text-[12.5px] font-bold text-brand-violet hover:text-brand-hover">
          See all →
        </Link>
      </div>
      {moves.map((t, i) => (
        <TransferRow key={t.id} transfer={t} divider={i > 0} />
      ))}
    </section>
  );
}
