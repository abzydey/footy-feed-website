export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 py-10">
      <img src="/logo-primary.png" alt="Full Set — Your team. The full set." className="w-full max-w-sm mb-6" />
      <h1 className="font-display font-extrabold text-3xl tracking-tight text-white mb-4">About Full Set</h1>
      <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
        <p>
          Full Set is a fan-focused companion for NRL supporters — one page per club with team lists, injury
          updates, and breaking news, plus a live competition ladder and a directory of upcoming fixtures. Follow
          your team, an individual player, or league-wide news to get alerted the moment something changes, right
          down to a last-minute team-list swap before kickoff.
        </p>
        <p>
          "What's Been Said" rounds up what NRL podcasts and shows are actually covering each week, and the Social
          tab surfaces the moments worth seeing from across X. Everything on Full Set is entered and reviewed by
          hand — it's built to be a fast, no-nonsense way to stay across your club, not another feed of noise.
        </p>
      </div>
    </div>
  );
}
