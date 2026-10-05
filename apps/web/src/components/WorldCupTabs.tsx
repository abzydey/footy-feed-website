import { NavLink } from "react-router-dom";

// Switches between the World Cup's two main views.
export default function WorldCupTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center text-[13px] font-bold rounded-[9px] py-2 transition-colors duration-150 ${
      isActive ? "bg-surface-hover text-white shadow-[0_1px_4px_rgba(0,0,0,0.4)]" : "text-white/50 hover:text-white"
    }`;
  return (
    <nav aria-label="World Cup" className="flex rounded-xl bg-white/[.05] border border-white/[.06] p-1 max-w-md">
      <NavLink to="/world-cup" end className={cls}>
        Fixtures &amp; results
      </NavLink>
      <NavLink to="/world-cup/teams" className={cls}>
        Teams &amp; squads
      </NavLink>
    </nav>
  );
}
