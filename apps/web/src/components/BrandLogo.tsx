// The header lockup (FS mark in its square, divider, FULLSET wordmark,
// tagline) as one vector file — brand/fullset-header-lockup.svg, copied to
// public/ by scripts/brand-assets.mjs. It's the only version of the
// wordmark: the link-preview image and the lockup exports are rendered from
// the same file. The light theme uses fullset-header-lockup-light.svg, the
// same file with the white wordmark recoloured navy; index.css shows the
// one that matches the theme.
export default function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img src="/brand/fullset-header-lockup.svg" alt="Full Set — Your team. The full set." className={`logo-on-dark ${className ?? ""}`} />
      <img src="/brand/fullset-header-lockup-light.svg" alt="Full Set — Your team. The full set." className={`logo-on-light ${className ?? ""}`} />
    </>
  );
}
