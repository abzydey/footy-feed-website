import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 px-1 pb-1 text-sm font-bold tracking-tight border-b-2 transition-colors duration-150 ${
    isActive ? "text-white border-brand-violet" : "text-slate-400 border-transparent hover:text-white"
  }`;

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 bg-app/90 backdrop-blur-sm border-b border-white/10">
      <nav className="max-w-5xl mx-auto flex items-center gap-4 px-3 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/nav-icon.png" alt="Full Set" className="h-7 w-auto" />
          <span className="font-display font-black text-lg tracking-tight text-white">
            NRL
          </span>
        </div>
        <div className="h-5 w-px bg-white/10 shrink-0" />
        <NavLink to="/" className={linkClass} end>
          Home
        </NavLink>
        <NavLink to="/news" className={linkClass}>
          News
        </NavLink>
        <NavLink to="/teams" className={linkClass}>
          Teams
        </NavLink>
        <NavLink to="/games" className={linkClass}>
          Games
        </NavLink>
        <NavLink to="/team-lists" className={linkClass}>
          Team Lists
        </NavLink>
        <NavLink to="/ladder" className={linkClass}>
          Ladder
        </NavLink>
        <NavLink to="/social" className={linkClass}>
          Social
        </NavLink>
        <NavLink to="/podcasts" className={linkClass}>
          Podcasts
        </NavLink>
        <NavLink to="/highlights" className={linkClass}>
          Highlights
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          What's Been Said
        </NavLink>
        <NavLink to="/admin" className={linkClass}>
          Admin
        </NavLink>
      </nav>
    </header>
  );
}
