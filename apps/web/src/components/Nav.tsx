import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"
  }`;

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <nav className="max-w-3xl mx-auto flex items-center gap-1 px-3 py-2 overflow-x-auto">
        <span className="font-bold text-white mr-2 whitespace-nowrap">Footy Feed</span>
        <NavLink to="/" className={linkClass} end>
          Teams
        </NavLink>
        <NavLink to="/search" className={linkClass}>
          Podcast search
        </NavLink>
        <NavLink to="/admin" className={linkClass}>
          Admin
        </NavLink>
      </nav>
    </header>
  );
}
