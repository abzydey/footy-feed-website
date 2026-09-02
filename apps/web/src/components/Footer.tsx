import { Link } from "react-router-dom";

// Site-wide footer — About link + a single equal-treatment partner row.
// Earlier versions gave House Money its own larger "Presented by" lockup
// with Arcane Accountants/Dream Drafting Sydney as smaller "supporting"
// partners below — by explicit request, that tiering is gone: all three
// sit in one row at identical height/spacing so no partner reads as more
// prominent than the others. No Full Set wordmark in this row either — the
// "Full Set always leads" rule was about Full Set's own presence next to a
// single presenting partner's lockup, which no longer applies now that
// there's no single/primary partner; Full Set's identity is already
// covered by "© Full Set" alongside and by the site's branding elsewhere.
// The old 60%-of-wordmark sizing formula that only applied to House Money
// is gone along with the tiering it existed to express.
//
// All three logos are pixel-scanned/cropped to their true visible bounding
// box (not raw file dimensions, which vary a lot between source assets) so
// that one shared CSS height renders them at comparable visual weight:
//  - house-money-wordmark.png: cropped to just the "HOUSE"/"MONEY" text
//    block (icon excluded), ~99.8% visible.
//  - arcane-accountants-logo.png / dream-drafting-sydney-logo.png: cropped
//    to their true visible bounds, background chroma-keyed to transparent,
//    Dream's near-black text/tagline recoloured to white (HSL
//    chroma/lightness classification, not a flat swap) while its saturated
//    red icon was left untouched.
const PARTNER_LOGO_HEIGHT = 20;
const PARTNERS = [
  { name: "House Money", href: "https://housemoney.au", logo: "/partners/house-money-wordmark.png" },
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

        <div className="flex flex-col items-center sm:items-end gap-1.5">
          <div className="flex items-center gap-3">
            <span className="font-display font-extrabold text-[9.5px] tracking-[.24em] text-white/42 uppercase">
              Our partners
            </span>
            <div className="flex items-center gap-4">
              {PARTNERS.map((p) => (
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
                    style={{ height: PARTNER_LOGO_HEIGHT }}
                    className="w-auto object-contain"
                  />
                </a>
              ))}
            </div>
          </div>
          <span className="text-[10px] text-slate-500">House Money is MFAA-accredited for mortgage broking</span>
        </div>
      </div>
    </footer>
  );
}
