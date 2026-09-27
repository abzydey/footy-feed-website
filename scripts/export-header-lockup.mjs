// Exports the website header lockup (FS mark in its square, divider,
// FULLSET wordmark, tagline) exactly as the live header renders it, by
// screenshotting the real BrandLogo element in a browser — at 2× and 4×,
// once on navy #04091B and once with a transparent background.
//
// Needs the site running locally first:
//   npm run build --workspace apps/web && npx vite preview --port 4173   (from apps/web)
//   node scripts/export-header-lockup.mjs [http://localhost:4173]
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "brand/generated/header");
const URL = process.argv[2] ?? "http://localhost:4173/";
const LOGO = 'header a[href="/"] > img'; // BrandLogo

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const scale of [2, 4]) {
  // Desktop width so the header uses its larger (sm:) logo size.
  const page = await browser.newPage({ viewport: { width: 1280, height: 400 }, deviceScaleFactor: scale });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const logo = page.locator(LOGO);

  await logo.evaluate((el) => (el.style.background = "#04091B"));
  await logo.screenshot({ path: path.join(OUT, `header-lockup-navy@${scale}x.png`) });

  await logo.evaluate((el) => (el.style.background = "transparent"));
  await page.addStyleTag({ content: "html,body,header,main{background:transparent!important;backdrop-filter:none!important}" });
  await logo.screenshot({ path: path.join(OUT, `header-lockup-transparent@${scale}x.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log(`Header lockup exported to ${path.relative(ROOT, OUT)}`);
