import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import BrandLogo from "./BrandLogo";
import { FooterContent } from "./Footer";
import { isNativeApp, tapHaptic } from "../lib/platform";
import { FINALS_IN_MENU, IN_SEASON, WORLD_CUP_IN_MENU } from "../lib/season";

// Navigation, two layouts from one list of pages:
// - Phones/tablets (below lg): a slim top bar (logo, search) plus a bottom
//   tab bar — Home, Finals (or Signings), World Cup while it's on, News,
//   Teams, More — the standard app pattern.
//   "More" opens a sheet with every other page. Same in the app and on the
//   phone website, on purpose: someone arriving from a shared link already
//   knows their way around the app.
// - Computers (lg and up): a normal top menu bar with a More dropdown.
// Admin is deliberately in neither — it's an unlisted route reached by
// typing /admin (or the © link in installed/native apps, see Footer.tsx).

type NavItem = { to: string; label: string; end?: boolean };

// Bottom tabs on phones.
const TABS: (NavItem & { icon: () => JSX.Element })[] = [
  { to: "/", label: "Home", end: true, icon: HomeIcon },
  // Finals is in the menu only while finals are on (back next September);
  // in the off-season its slot goes to the signings tracker.
  ...(FINALS_IN_MENU
    ? [{ to: "/finals", label: "Finals", icon: TrophyIcon }]
    : [{ to: "/signings", label: "Signings", icon: SwapIcon }]),
  ...(WORLD_CUP_IN_MENU ? [{ to: "/world-cup", label: "World Cup", icon: GlobeIcon }] : []),
  { to: "/news", label: "News", icon: NewsIcon },
  { to: "/teams", label: "Teams", icon: ShieldIcon },
];

// Shown inline in the computer menu bar, before "More". In season the bar carries the weekly pages (Games, Team Lists, Injuries);
// in the off-season those have nothing new, so they move into More and the
// bar gets what people follow over summer.
const DESKTOP_LINKS: NavItem[] = IN_SEASON
  ? [
      { to: "/", label: "Home", end: true },
      FINALS_IN_MENU ? { to: "/finals", label: "Finals" } : { to: "/ladder", label: "Ladder" },
      { to: "/news", label: "News" },
      { to: "/teams", label: "Teams" },
      { to: "/games", label: "Games" },
      { to: "/team-lists", label: "Team Lists" },
      { to: "/injuries", label: "Injuries" },
    ]
  : [
      { to: "/", label: "Home", end: true },
      { to: "/signings", label: "Signings" },
      { to: "/world-cup", label: "World Cup" },
      { to: "/news", label: "News" },
      { to: "/teams", label: "Teams" },
      { to: "/ladder", label: "Ladder" },
    ];

// Everything else. The phone More sheet lists all of these; the computer
// dropdown skips the ones already in its menu bar. My Teams / Signing News /
// Top Stories used to be the pills on Home — this is their home now.
const MORE_LINKS: NavItem[] = [
  { to: "/world-cup", label: "World Cup" },
  { to: "/games", label: "Games" },
  { to: "/team-lists", label: "Team Lists" },
  { to: "/injuries", label: "Injuries" },
  { to: "/judiciary", label: "Judiciary" },
  { to: "/signings", label: "Signings Tracker" },
  { to: "/feed/my-teams", label: "My Teams" },
  { to: "/feed/signings", label: "Signing News" },
  { to: "/feed/top", label: "Top Stories" },
  { to: "/social", label: "Social" },
  { to: "/podcasts", label: "Podcasts" },
  { to: "/highlights", label: "Highlights" },
  { to: "/search", label: "What's Been Said" },
  { to: "/ladder", label: "Ladder" },
];
const DESKTOP_MORE = MORE_LINKS.filter((m) => !DESKTOP_LINKS.some((d) => d.to === m.to));

function matches(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export default function Nav() {
  const { pathname } = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Picking a page anywhere closes the sheet.
  useEffect(() => setSheetOpen(false), [pathname]);

  const moreActive = !TABS.some((t) => matches(pathname, t)) && MORE_LINKS.some((m) => matches(pathname, m));

  return (
    <>
      <header className="sticky top-0 z-20 bg-app/90 backdrop-blur-sm border-b border-white/[.07] pt-[env(safe-area-inset-top)]">
        {/* Phones: logo centred, search on the right. The empty box on the
            left balances the search button so the logo sits truly centred. */}
        <div className="lg:hidden flex items-center justify-between px-2 h-[52px]">
          <span className="w-11 h-11" aria-hidden="true" />
          <Link to="/" aria-label="Full Set home">
            <BrandLogo className="h-[30px] w-auto" />
          </Link>
          <Link
            to="/search"
            aria-label="Search"
            onClick={tapHaptic}
            className="w-11 h-11 flex items-center justify-center text-slate-300 hover:text-white"
          >
            <SearchIcon />
          </Link>
        </div>

        {/* Computers: logo left, menu, search pill right. */}
        <div className="hidden lg:flex max-w-6xl mx-auto items-center gap-9 px-5 h-[68px]">
          <Link to="/" aria-label="Full Set home" className="shrink-0">
            <BrandLogo className="h-[32px] w-auto" />
          </Link>
          <nav aria-label="Main" className="flex-1 flex items-center gap-6 h-full">
            {DESKTOP_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `h-full flex items-center border-b-2 text-[14.5px] transition-colors duration-150 ${
                    isActive
                      ? "border-brand-violet text-white font-bold"
                      : "border-transparent text-slate-400 font-semibold hover:text-white"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <DesktopMore active={DESKTOP_MORE.some((m) => matches(pathname, m))} />
          </nav>
          <Link
            to="/search"
            className="shrink-0 h-10 flex items-center gap-2 rounded-full border border-white/10 bg-surface pl-3 pr-4 text-[13.5px] text-slate-400 hover:text-white hover:border-white/20 transition-colors duration-150"
          >
            <SearchIcon size={18} />
            Search
          </Link>
        </div>
      </header>

      {/* Siblings of <header>, not inside it: the header's backdrop-blur
          makes it the containing block for position:fixed children, which
          would size these against the header instead of the screen. */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[#060B1E]/95 backdrop-blur-md border-t border-white/[.08] pb-[env(safe-area-inset-bottom)]"
      >
        <div className={`grid ${TABS.length === 5 ? "grid-cols-6" : "grid-cols-5"} h-14`}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              onClick={tapHaptic}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-[3px] text-[10.5px] transition-colors duration-150 ${
                  isActive && !sheetOpen ? "text-brand-violet font-bold" : "text-slate-400 font-semibold"
                }`
              }
            >
              <tab.icon />
              {tab.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => {
              tapHaptic();
              setSheetOpen((o) => !o);
            }}
            aria-expanded={sheetOpen}
            className={`flex flex-col items-center justify-center gap-[3px] text-[10.5px] transition-colors duration-150 ${
              sheetOpen || moreActive ? "text-brand-violet font-bold" : "text-slate-400 font-semibold"
            }`}
          >
            <DotsIcon />
            More
          </button>
        </div>
      </nav>

      <MoreSheet open={sheetOpen} onClose={() => setSheetOpen(false)} pathname={pathname} />
    </>
  );
}

// Slides up from above the tab bar. Every other page as a two-column grid
// of big tap targets; in the app, About/partners/© sit at the bottom too,
// since the app hides the site footer (see App.tsx).
function MoreSheet({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className={`lg:hidden fixed inset-0 z-20 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-label="More pages"
        className={`absolute inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-h-[75vh] overflow-y-auto rounded-t-[22px] bg-surface-hover border-t border-white/10 px-4 pt-3 pb-5 transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "translate-y-[110%]"
        }`}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="grid grid-cols-2 gap-2">
          {MORE_LINKS.filter((link) => !TABS.some((t) => t.to === link.to)).map((link) => {
            const active = matches(pathname, link);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={tapHaptic}
                className={`rounded-xl px-4 py-3.5 text-[14.5px] font-bold border transition-colors duration-150 ${
                  active
                    ? "border-brand-violet/60 bg-brand-violet/15 text-white"
                    : "border-white/[.07] bg-surface text-slate-200 active:bg-white/[.06]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        {isNativeApp && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <FooterContent stacked />
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopMore({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`h-full flex items-center gap-1 border-b-2 text-[14.5px] transition-colors duration-150 ${
          active ? "border-brand-violet text-white font-bold" : "border-transparent text-slate-400 font-semibold hover:text-white"
        }`}
      >
        More
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={open ? "rotate-180" : ""}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%-6px)] w-56 rounded-xl border border-white/10 bg-surface-hover p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]">
          {DESKTOP_MORE.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors duration-150 ${
                  isActive ? "bg-brand-violet/15 text-white" : "text-slate-300 hover:bg-white/[.05] hover:text-white"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4L3 8l4 4" />
      <path d="M3 8h13" />
      <path d="M17 20l4-4-4-4" />
      <path d="M21 16H8" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
