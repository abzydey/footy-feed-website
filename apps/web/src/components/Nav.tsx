import { useState } from "react";
import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-1 pb-1 text-sm font-bold tracking-tight border-b-2 transition-colors duration-150 ${
    isActive ? "text-white border-brand-violet" : "text-slate-400 border-transparent hover:text-white"
  }`;

// Every public section, in the drawer. Admin is deliberately not in this
// list — it's an unlisted route (see App.tsx: "Routes not listed here
// (search, admin) are handled separately below"), reached only by typing
// /admin directly, not surfaced in any nav a tester/fan would see, even
// though the page itself is already auth-gated regardless. Ladder is last:
// with the regular season over and finals underway, the ladder is frozen
// and no longer the thing anyone's checking day to day.
const DRAWER_LINKS: { to: string; label: string }[] = [
  { to: "/", label: "Home" },
  { to: "/finals", label: "Finals" },
  { to: "/news", label: "News" },
  { to: "/teams", label: "Teams" },
  { to: "/games", label: "Games" },
  { to: "/team-lists", label: "Team Lists" },
  { to: "/judiciary", label: "Judiciary" },
  { to: "/injuries", label: "Injuries" },
  { to: "/social", label: "Social" },
  { to: "/podcasts", label: "Podcasts" },
  { to: "/highlights", label: "Highlights" },
  { to: "/search", label: "What's Been Said" },
  { to: "/ladder", label: "Ladder" },
];

// The quick-access row under the logo — every public page, same order as
// the drawer above ("the menu bar still needs to have every page"). The
// drawer duplicates all of these too, same as Bleacher Report's own row +
// hamburger both existing at once — this row is the one-tap default, the
// drawer's just an alternate way in.
const QUICK_LINKS: { to: string; label: string; end?: boolean }[] = DRAWER_LINKS.map((l) =>
  l.to === "/" ? { ...l, end: true } : l
);

const HamburgerIcon = () => (
  <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
    <path d="M0 1h22M0 8h22M0 15h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Slide-in drawer, same shape as Bleacher Report's hamburger menu: a
// backdrop, a fixed-width panel from the left edge, a plain vertical list of
// every section. Closes on backdrop click or picking a link. No trailing
// chevrons — every item here navigates directly, none open a submenu, so an
// arrow implying "more inside" would misrepresent what tapping it does.
function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div className={`fixed inset-0 z-30 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      {/* surface-hover (not the plain surface card colour) plus its own
          shadow on the right edge — surface alone sits too close in
          luminance to the dimmed backdrop for the panel to read as a
          distinct layer on top of the page. */}
      <div
        className={`absolute inset-y-0 left-0 w-[78%] max-w-xs bg-surface-hover border-r border-brand-violet/25 shadow-[12px_0_40px_-8px_rgba(0,0,0,0.65)] transition-transform duration-200 flex flex-col ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-brand-violet/20">
          <div className="flex items-center gap-2">
            <img src="/nav-icon.png" alt="" className="h-7 w-7 rounded-md" />
            <span className="font-display font-black text-white tracking-tight">FULL SET</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="text-slate-400 hover:text-white p-1"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {DRAWER_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `block border-l-2 px-4 py-3 text-[15px] font-bold tracking-tight transition-colors duration-150 ${
                  isActive
                    ? "border-brand-violet bg-brand-violet/10 text-white"
                    : "border-transparent text-slate-300 hover:text-white hover:bg-white/[.04]"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-20 bg-app/90 backdrop-blur-sm border-b border-white/10">
        {/* Logo gets its own row — the full lockup (icon + FULLSET + tagline)
            already says everything Home's old intro text block used to say
            separately, which is what made that text redundant. */}
        <div className="max-w-5xl mx-auto flex items-center justify-center px-3 pt-2.5 pb-2">
          <NavLink to="/">
            <img src="/logo-primary.png" alt="Full Set — Your team. The full set." className="h-12 sm:h-14 w-auto" />
          </NavLink>
        </div>
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-3 pb-2.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="shrink-0 text-white/80 hover:text-white p-1 -ml-1"
          >
            <HamburgerIcon />
          </button>
          <nav className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
            {QUICK_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {/* Rendered as a sibling of <header>, not inside it — the header has
          backdrop-blur-sm (a backdrop-filter), and per the CSS spec any of
          filter/backdrop-filter/transform/perspective/will-change on an
          ancestor establishes a new containing block for position:fixed
          descendants. With the drawer nested inside <header>, its "fixed
          inset-0" was being sized against the header's own ~86px content
          height instead of the viewport — confirmed by measuring the actual
          rendered rect before this fix (height: 86 instead of the full
          viewport height). Moving it outside sidesteps the whole issue. */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
