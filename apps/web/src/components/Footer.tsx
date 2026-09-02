import { Link } from "react-router-dom";

// Site-wide footer — About link + sponsor credit. The sponsor lockup follows
// the brand handoff's section 6 spec exactly: Full Set's own wordmark always
// leads, House Money sits at 60% of that wordmark's rendered height,
// separated by a hairline rule (--fs-hairline #232B45) rather than House
// Money appearing alone — a bare partner logo with no Full Set mark reads as
// House Money's own footer, not a "presented by" credit.
//
// "60% of the wordmark height" means 60% of the *visible ink*, not either
// file's raw dimensions — pixel-scanned both source assets to confirm:
//  - fullset-wordmark.svg has ~9% built-in vertical padding (visible height
//    is 91% of its rendered box), so setting both images to the same CSS
//    height without correcting for that would already be wrong.
//  - the original house-money-logo.png is a 3-row stacked lockup (roof icon,
//    then "HOUSE", then "MONEY" on separate lines) — comparing its raw file
//    height to Full Set's single-line wordmark isn't an apples-to-apples
//    comparison, since a third of its height is a roof icon glyph that has
//    no equivalent in the Full Set wordmark at all. Cropped it down to just
//    the "HOUSE"/"MONEY" text block (house-money-wordmark.png, tightly
//    bound, ~99.8% visible) so the comparison is wordmark-to-wordmark.
const FULLSET_WORDMARK_HEIGHT = 15;
const FULLSET_WORDMARK_VISIBLE_RATIO = 0.91;
const HOUSE_MONEY_VISIBLE_RATIO = 0.998;
const HOUSE_MONEY_HEIGHT =
  (FULLSET_WORDMARK_HEIGHT * FULLSET_WORDMARK_VISIBLE_RATIO * 0.6) / HOUSE_MONEY_VISIBLE_RATIO;

// Secondary sponsors, kept in their own row below the "Presented by" lockup
// rather than folded into it — the brand handoff explicitly lists "more
// than one presenting partner in a lockup" as a never. Equal-tier with each
// other (unlike House Money above, neither leads).
//
// Both logos sit directly on the dark footer with no background box, same
// treatment as House Money above. Their source files were flat exports on a
// white background with no dark-mode variant, so getting there took real
// per-logo work rather than a generic "strip to transparent":
//  - Arcane Accountants' palette (blue/grey text, a light-outlined icon) was
//    already legible on navy once the white background was chroma-keyed
//    out -- no recolouring needed.
//  - Dream Drafting Sydney's wordmark and tagline are near-black, which
//    would just disappear once composited on navy. Recoloured every
//    low-saturation dark pixel (the text) to white while leaving the
//    saturated red icon untouched -- classified by chroma/lightness in
//    HSL terms, not a flat "black to white" swap, so the red brand mark
//    survives intact.
//  - Both source files also had very different amounts of built-in padding
//    around their actual marks (Dream's had ~50-58px of margin baked in on
//    every side, Arcane's had almost none) — same lesson as
//    house-money-wordmark.png earlier: pixel-scanned each to its true
//    visible bounding box and cropped to that (+a small uniform margin), so
//    setting both to the same CSS height renders them at comparable visual
//    weight instead of Dream reading smaller inside its own frame.
const SUPPORTING_PARTNER_HEIGHT = 20;
const SUPPORTING_PARTNERS = [
  { name: "Arcane Accountants", href: "https://arcaneaccountants.com", logo: "/partners/arcane-accountants-logo.png" },
  {
    name: "Dream Drafting Sydney",
    href: "https://dreamdraftingsydney.com.au",
    logo: "/partners/dream-drafting-sydney-logo.png",
  },
];

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
              src="/partners/house-money-wordmark.png"
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

      <div className="max-w-3xl mx-auto px-4 pb-6 flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-3 border-t border-white/[.06] pt-4">
        <span className="font-display font-extrabold text-[9.5px] tracking-[.24em] text-white/42 uppercase">
          Supporting partners
        </span>
        <div className="flex items-center gap-5">
          {SUPPORTING_PARTNERS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center hover:opacity-80 transition-opacity duration-150"
            >
              <img
                src={p.logo}
                alt={p.name}
                style={{ height: SUPPORTING_PARTNER_HEIGHT }}
                className="w-auto object-contain"
              />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
