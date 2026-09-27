// Renders every logo/icon size from the SVG sources in brand/ — nothing is
// traced or redrawn, sharp rasterises the SVGs directly. Re-run after any
// change to brand/*.svg:
//
//   node scripts/brand-assets.mjs
//
// Outputs go to brand/generated/ (the full reference set) and are copied into
// the places that use them: the website's public/ folder (favicons, PWA
// icons, header logo), the iOS AppIcon asset catalog, and Android's launcher
// mipmaps. Rule for app icons: anything shown at 120px or smaller uses the
// seam-only ball (fullset-appicon-seam.svg), which reads better tiny; larger
// sizes use the striped ball.
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = path.join(ROOT, "brand");
const OUT = path.join(BRAND, "generated");
const WEB = path.join(ROOT, "apps/web");
const PUBLIC = path.join(WEB, "public");
const IOS_ICONSET = path.join(WEB, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const ANDROID_RES = path.join(WEB, "android/app/src/main/res");
const NAVY = "#04091B";

const SVG = {
  lockup: path.join(BRAND, "fullset-lockup.svg"),
  appicon: path.join(BRAND, "fullset-appicon.svg"),
  appiconSeam: path.join(BRAND, "fullset-appicon-seam.svg"),
  favicon: path.join(BRAND, "favicon.svg"),
};

// Rasterise at (at least) the target size so downscaling never upsamples.
async function render(svgPath, width, { opaque = false } = {}) {
  const meta = await sharp(svgPath).metadata();
  const density = Math.max(72, Math.ceil((72 * width) / meta.width) * 2);
  let img = sharp(svgPath, { density }).resize({ width, kernel: "lanczos3" });
  if (opaque) img = img.flatten({ background: NAVY }).removeAlpha();
  return img.png({ compressionLevel: 9 }).toBuffer();
}

const appIconFor = (px) => (px <= 120 ? SVG.appiconSeam : SVG.appicon);

// PNG-in-ICO container (supported by every browser since IE Vista-era) —
// sharp can't write .ico itself.
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
}

async function write(file, buf) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
}

async function main() {
  await rm(OUT, { recursive: true, force: true });

  // 1. Lockup PNGs, transparent (width in px)
  for (const w of [1024, 512, 120, 64]) {
    await write(path.join(OUT, `lockup/fullset-lockup-${w}.png`), await render(SVG.lockup, w));
  }

  // 2. App icons (opaque — Apple rejects app icons with an alpha channel)
  for (const px of [1024, 512, 180, 120, 60, 40]) {
    await write(path.join(OUT, `appicon/appicon-${px}.png`), await render(appIconFor(px), px, { opaque: true }));
  }

  // 3. Favicons
  const fav = {};
  for (const px of [48, 32, 16]) {
    fav[px] = await render(SVG.favicon, px, { opaque: true });
    await write(path.join(OUT, `favicon/favicon-${px}.png`), fav[px]);
  }
  const ico = buildIco([16, 32, 48].map((size) => ({ size, buf: fav[size] })));
  await write(path.join(OUT, "favicon/favicon.ico"), ico);
  const appleTouch = await render(SVG.favicon, 180, { opaque: true });
  await write(path.join(OUT, "favicon/apple-touch-icon.png"), appleTouch);

  // --- Website ---
  await write(path.join(PUBLIC, "favicon.ico"), ico);
  await write(path.join(PUBLIC, "favicon-16.png"), fav[16]);
  await write(path.join(PUBLIC, "favicon-32.png"), fav[32]);
  await write(path.join(PUBLIC, "favicon-48.png"), fav[48]);
  await copyFile(SVG.favicon, path.join(PUBLIC, "favicon.svg"));
  await write(path.join(PUBLIC, "apple-touch-icon.png"), appleTouch);
  // PWA manifest (Chrome's install criteria want 192 + 512)
  await write(path.join(PUBLIC, "icon-192.png"), await render(SVG.appicon, 192, { opaque: true }));
  await write(path.join(PUBLIC, "icon-512.png"), await render(SVG.appicon, 512, { opaque: true }));
  // Nav drawer icon — shown at 28px, so the seam version
  await write(path.join(PUBLIC, "nav-icon.png"), await render(SVG.appiconSeam, 120, { opaque: true }));
  await copyFile(SVG.lockup, path.join(PUBLIC, "brand/fullset-lockup.svg")).catch(async () => {
    await mkdir(path.join(PUBLIC, "brand"), { recursive: true });
    await copyFile(SVG.lockup, path.join(PUBLIC, "brand/fullset-lockup.svg"));
  });
  await buildHeaderBase();

  // --- Capacitor source icon (what `capacitor-assets` would read) ---
  await write(path.join(WEB, "resources/icon.png"), await render(SVG.appicon, 1024, { opaque: true }));

  // --- iOS: explicit sizes for iPhone + iPad (TARGETED_DEVICE_FAMILY 1,2)
  // so small slots get the seam artwork instead of Xcode downscaling the
  // striped 1024. ---
  const iosSlots = [
    ["iphone", "20x20", "2x", 40], ["iphone", "20x20", "3x", 60],
    ["iphone", "29x29", "2x", 58], ["iphone", "29x29", "3x", 87],
    ["iphone", "40x40", "2x", 80], ["iphone", "40x40", "3x", 120],
    ["iphone", "60x60", "2x", 120], ["iphone", "60x60", "3x", 180],
    ["ipad", "20x20", "1x", 20], ["ipad", "20x20", "2x", 40],
    ["ipad", "29x29", "1x", 29], ["ipad", "29x29", "2x", 58],
    ["ipad", "40x40", "1x", 40], ["ipad", "40x40", "2x", 80],
    ["ipad", "76x76", "1x", 76], ["ipad", "76x76", "2x", 152],
    ["ipad", "83.5x83.5", "2x", 167],
    ["ios-marketing", "1024x1024", "1x", 1024],
  ];
  await rm(IOS_ICONSET, { recursive: true, force: true });
  await mkdir(IOS_ICONSET, { recursive: true });
  const rendered = new Map();
  const images = [];
  for (const [idiom, size, scale, px] of iosSlots) {
    const filename = `AppIcon-${px}.png`;
    if (!rendered.has(px)) {
      await write(path.join(IOS_ICONSET, filename), await render(appIconFor(px), px, { opaque: true }));
      rendered.set(px, true);
    }
    images.push({ idiom, size, scale, filename });
  }
  await write(path.join(IOS_ICONSET, "Contents.json"), JSON.stringify({ images, info: { author: "xcode", version: 1 } }, null, 2) + "\n");

  // --- Android: legacy launcher (48dp) + adaptive layers (108dp, shown
  // through a 16.7% inset — see mipmap-anydpi-v26/ic_launcher.xml — so the
  // artwork's visible size is 2/3 of the layer). ---
  const densities = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(densities)) {
    const dir = path.join(ANDROID_RES, `mipmap-${d}`);
    const L = Math.round(48 * k);
    const F = Math.round(108 * k);
    const legacy = await render(appIconFor(L), L, { opaque: true });
    await write(path.join(dir, "ic_launcher.png"), legacy);
    const circle = Buffer.from(`<svg width="${L}" height="${L}"><circle cx="${L / 2}" cy="${L / 2}" r="${L / 2}"/></svg>`);
    await write(
      path.join(dir, "ic_launcher_round.png"),
      await sharp(legacy).ensureAlpha().composite([{ input: circle, blend: "dest-in" }]).png().toBuffer()
    );
    await write(path.join(dir, "ic_launcher_foreground.png"), await render(appIconFor(Math.round(F * 2 / 3)), F, { opaque: true }));
    await write(
      path.join(dir, "ic_launcher_background.png"),
      await sharp({ create: { width: F, height: F, channels: 3, background: NAVY } }).png().toBuffer()
    );
  }

  await buildSplashes();
  await buildOgImage();
  await buildSocialAvatars();

  console.log("Brand assets rendered.");
}

// Launch (splash) screens: the lockup centred on navy at 18% of the
// shorter side — the same proportion the previous splash used. Every
// existing splash file in the iOS asset catalog and Android drawable
// folders is re-rendered at its own size and orientation, plus the
// 2732×2732 Capacitor source in resources/.
async function splashPng(width, height) {
  const logoW = Math.round(Math.min(width, height) * 0.18);
  const logo = await render(SVG.lockup, logoW);
  const { height: logoH } = await sharp(logo).metadata();
  return sharp({ create: { width, height, channels: 3, background: NAVY } })
    .composite([{ input: logo, left: Math.round((width - logoW) / 2), top: Math.round((height - logoH) / 2) }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function buildSplashes() {
  const { readdir } = await import("node:fs/promises");
  const targets = [path.join(WEB, "resources/splash.png")];
  const iosSplash = path.join(WEB, "ios/App/App/Assets.xcassets/Splash.imageset");
  for (const f of await readdir(iosSplash)) if (f.endsWith(".png")) targets.push(path.join(iosSplash, f));
  for (const d of await readdir(ANDROID_RES)) {
    if (!d.startsWith("drawable")) continue;
    const f = path.join(ANDROID_RES, d, "splash.png");
    try {
      await sharp(f).metadata();
      targets.push(f);
    } catch {
      /* folder has no splash.png */
    }
  }
  for (const f of targets) {
    const { width, height } = await sharp(f).metadata();
    await write(f, await splashPng(width, height));
  }
  await write(path.join(OUT, "splash/splash-2732.png"), await splashPng(2732, 2732));
}

// Profile pictures for X (400×400) and Instagram (1080×1080), from
// fullset-appicon.svg. Both platforms crop avatars to a circle, so instead
// of trusting the icon's built-in clear space, this measures the logo's
// furthest point from the centre and scales the artwork so that point sits
// at 72% of the circle's radius, leaving a clear ring inside any crop.
async function buildSocialAvatars() {
  const probe = 1024;
  const { data } = await sharp(await render(SVG.appicon, probe, { opaque: true })).raw().toBuffer({ resolveWithObject: true });
  const bg = [4, 9, 27];
  let maxR = 0;
  for (let y = 0; y < probe; y++) {
    for (let x = 0; x < probe; x++) {
      const i = (y * probe + x) * 3;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 30) {
        maxR = Math.max(maxR, Math.hypot(x + 0.5 - probe / 2, y + 0.5 - probe / 2));
      }
    }
  }
  const scale = Math.min(1, (0.72 * (probe / 2)) / maxR);
  for (const [name, size] of [["x-400", 400], ["instagram-1080", 1080]]) {
    const inner = Math.round(size * scale);
    const art = await render(SVG.appicon, inner, { opaque: true });
    const off = Math.round((size - inner) / 2);
    const avatar = await sharp({ create: { width: size, height: size, channels: 3, background: NAVY } })
      .composite([{ input: art, left: off, top: off }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    await write(path.join(OUT, `social/avatar-${name}.png`), avatar);
  }
  console.log(`Social avatars: logo reaches ${Math.round((maxR / (probe / 2)) * 100)}% of the radius unscaled, scaled by ${scale.toFixed(3)}`);
}

// Link-preview image (og:image / twitter:image, 1200×630): the same
// composition as the site header — header base art plus the SVG mark in
// its square (see BrandLogo.tsx for the percentages) — centred on navy at
// the width the previous share image used.
async function buildOgImage() {
  const W = 1200;
  const H = 630;
  const lockupW = 920;
  const base = await sharp(path.join(PUBLIC, "brand/logo-header-base.png")).resize({ width: lockupW }).toBuffer();
  const { height: baseH } = await sharp(base).metadata();
  const markW = Math.round(lockupW * 0.1629);
  const mark = await render(SVG.lockup, markW);
  const left = Math.round((W - lockupW) / 2);
  const top = Math.round((H - baseH) / 2);
  const og = await sharp({ create: { width: W, height: H, channels: 3, background: NAVY } })
    .composite([
      { input: base, left, top },
      { input: mark, left: left + Math.round(lockupW * 0.0769), top: top + Math.round(baseH * 0.2796) },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await write(path.join(PUBLIC, "og-default.png"), og);
  await write(path.join(OUT, "og/og-default.png"), og);
}

// The header logo (square + divider + FULLSET wordmark + tagline) exists
// only as one flat PNG, public/logo-primary.png, with the old FS icon and a
// lighter navy background baked in. This keeps every pixel of the square,
// divider, wordmark and tagline, but (a) turns the background transparent
// ("colour to alpha" against the measured background colour, so
// anti-aliased edges stay clean) and (b) clears the inside of the square so
// the new fullset-lockup.svg can sit there as a real SVG (see BrandLogo.tsx).
async function buildHeaderBase() {
  const src = path.join(PUBLIC, "logo-primary.png");
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const out = Buffer.alloc(W * H * 4);
  const BG = [9, 13, 31]; // measured from the image's corners/margins
  const px = (x, y) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const p = [data[i], data[i + 1], data[i + 2]];
    // Background noise, plus the artwork's dark drop shadows (pixels no
    // lighter than the background): the shadows were near-invisible on the
    // navy header but showed as grey smudges on any lighter background once
    // the logo was exported transparent, so they're dropped entirely.
    if (Math.max(...p.map((v, c) => Math.abs(v - BG[c]))) <= 6 || p.every((v, c) => v <= BG[c] + 6)) {
      out[j + 3] = 0;
      continue;
    }
    let a = 0;
    for (let c = 0; c < 3; c++) {
      const t = p[c] > BG[c] ? (p[c] - BG[c]) / (255 - BG[c]) : (BG[c] - p[c]) / BG[c];
      a = Math.max(a, t);
    }
    a = Math.min(1, a);
    for (let c = 0; c < 3; c++) out[j + c] = Math.round(Math.min(255, Math.max(0, BG[c] + (p[c] - BG[c]) / a)));
    out[j + 3] = Math.round(a * 255);
  }

  // Clear the square's interior. The outline is found by scanning inward
  // from its outer edge and skipping the purple run, so the old purple ball
  // inside (separated from the outline by navy) is not mistaken for it.
  const SQ = { x0: 55, x1: 362, y0: 41, y1: 350 };
  const isPurple = ([r, g, b]) => b - g > 40 && r - g > 15;
  const innerRange = (get, from, to, step) => {
    let k = from;
    while (k !== to && !isPurple(get(k))) k += step; // reach the outline
    while (k !== to && isPurple(get(k))) k += step; // cross it
    return k;
  };
  for (let y = SQ.y0; y <= SQ.y1; y++) {
    const L = innerRange((x) => px(x, y), SQ.x0 - 4, SQ.x1, 1);
    const R = innerRange((x) => px(x, y), SQ.x1 + 4, SQ.x0, -1);
    for (let x = L; x <= R; x++) {
      const T = innerRange((yy) => px(x, yy), SQ.y0 - 4, SQ.y1, 1);
      const B = innerRange((yy) => px(x, yy), SQ.y1 + 4, SQ.y0, -1);
      if (y >= T && y <= B) out[(y * W + x) * 4 + 3] = 0;
    }
  }

  await write(
    path.join(PUBLIC, "brand/logo-header-base.png"),
    await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer()
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
