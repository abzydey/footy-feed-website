import { NavLink } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-full text-sm font-bold tracking-tight transition-colors ${
    isActive ? "bg-brand-violet text-white" : "text-slate-300 hover:bg-white/5 hover:text-brand-heliotrope"
  }`;

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <nav className="max-w-3xl mx-auto flex items-center gap-1 px-3 py-2 overflow-x-auto">
        <span className="font-display font-black text-xl tracking-tight text-white mr-2 whitespace-nowrap">
          Footy <span className="text-brand-heliotrope">Feed</span>
        </span>
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
