import { Link } from "react-router-dom";

// Site-wide footer — About link + sponsor credit. The sponsor lockup follows
// the brand handoff's section 6 spec exactly: Full Set's own wordmark always
// leads, House Money sits at 60% of that wordmark's rendered height,
// separated by a hairline rule (--fs-hairline #232B45) rather than House
// Money appearing alone — a bare partner logo with no Full Set mark reads as
// House Money's own footer, not a "presented by" credit.
const FULLSET_WORDMARK_HEIGHT = 15;
const HOUSE_MONEY_HEIGHT = FULLSET_WORDMARK_HEIGHT * 0.6; // spec: "60% of the Full Set wordmark height"

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

        <div className="flex items-center gap-3">
          <img src="/brand/fullset-wordmark.svg" alt="Full Set" style={{ height: FULLSET_WORDMARK_HEIGHT }} className="w-auto" />
          <span className="h-4 w-px bg-[#232B45]" aria-hidden="true" />
          <a
            href="https://housemoney.au"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 text-xs text-slate-400 hover:opacity-80 transition-opacity duration-150"
          >
            <span className="font-display font-extrabold text-[9.5px] tracking-[.24em] text-white/42 uppercase">
              Presented by
            </span>
            <img
              src="/partners/house-money-logo.png"
              alt="House Money"
              style={{ height: HOUSE_MONEY_HEIGHT }}
              className="w-auto object-contain"
            />
            <span className="text-[10px] text-slate-500 leading-tight">
              MFAA-accredited
              <br />
              mortgage broking
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
