// Makes the app icons match the social profile picture (navy with the purple
// glow): PWA icons, the iOS AppIcon set and Android launcher icons. Run this
// after scripts/brand-assets.mjs, which still draws icons on the old darker navy.
//
//   node scripts/app-icons-from-avatar.mjs
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "apps/web");
const SOURCE = path.join(ROOT, "brand/generated/social/avatar-instagram-1080.png");
const IOS_ICONSET = path.join(WEB, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
const ANDROID_RES = path.join(WEB, "android/app/src/main/res");
const BACKGROUND = "#0B1533";

const icon = (px) =>
  sharp(SOURCE).resize(px, px, { kernel: "lanczos3" }).flatten({ background: BACKGROUND }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
const write = async (file, px) => writeFile(file, await icon(px));

// Website and home-screen app.
await write(path.join(WEB, "public/apple-touch-icon.png"), 180);
await write(path.join(WEB, "public/icon-192.png"), 192);
await write(path.join(WEB, "public/icon-512.png"), 512);
await write(path.join(WEB, "public/nav-icon.png"), 120);
await write(path.join(WEB, "resources/icon.png"), 1024);
for (const px of [40, 60, 120, 180, 512, 1024]) await write(path.join(ROOT, `brand/generated/appicon/appicon-${px}.png`), px);

// iOS: every size already in the set, named AppIcon-<px>.png.
for (const name of await readdir(IOS_ICONSET)) {
  const match = name.match(/^AppIcon-(\d+)\.png$/);
  if (match) await write(path.join(IOS_ICONSET, name), Number(match[1]));
}

// Android: the logo sits within the avatar safely inside the adaptive icon crop.
const densities = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(densities)) {
  const dir = path.join(ANDROID_RES, `mipmap-${density}`);
  const legacy = Math.round(48 * scale);
  const layer = Math.round(108 * scale);
  await write(path.join(dir, "ic_launcher.png"), legacy);
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await writeFile(path.join(dir, "ic_launcher_round.png"), await sharp(await icon(legacy)).ensureAlpha().composite([{ input: circle, blend: "dest-in" }]).png().toBuffer());
  await write(path.join(dir, "ic_launcher_foreground.png"), layer);
  await writeFile(path.join(dir, "ic_launcher_background.png"), await sharp({ create: { width: layer, height: layer, channels: 3, background: BACKGROUND } }).png().toBuffer());
}

console.log("App icons rebuilt from", path.relative(ROOT, SOURCE));
