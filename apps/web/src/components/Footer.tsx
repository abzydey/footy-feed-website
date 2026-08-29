import { Link } from "react-router-dom";

/**
 * Site-wide footer — About link + partner credit, same convention as a
 * sports media site crediting a sponsor. house-money-logo.png is the
 * "Light" (white/blue-on-transparent) variant, verified to have real alpha
 * transparency and opaque white/blue fills — it reads cleanly against this
 * dark footer as-is, no background treatment needed.
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-10">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <Link to="/about" className="hover:text-white transition-colors duration-150">
            About
          </Link>
          <span>© {new Date().getFullYear()} Full Set</span>
        </div>

        <a
          href="https://housemoney.au"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 text-xs text-slate-400 hover:opacity-80 transition-opacity duration-150"
        >
          <span>Partner:</span>
          <img src="/partners/house-money-logo.png" alt="House Money" className="h-9 w-auto object-contain" />
          <span className="text-[10px] text-slate-500 leading-tight">
            MFAA-accredited
            <br />
            mortgage broking
          </span>
        </a>
      </div>
    </footer>
  );
}
