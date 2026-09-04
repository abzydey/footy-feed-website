// Node 18 doesn't expose `File` as a global (it was promoted to a true
// global only in Node 20) — cheerio's bundled undici dependency
// (lib/lateMailParser.ts) references `File` unconditionally at
// module-load time, which crashed the *entire* API on startup under
// Railway's Node 18 runtime, not just the late-mail feature. `File` has
// existed on node:buffer since Node 18.13 though, just not globally —
// this promotes it before anything else can load. Must be the very
// first import in index.ts, ahead of every other module.
import { File } from "node:buffer";

if (typeof globalThis.File === "undefined") {
  (globalThis as unknown as { File: unknown }).File = File;
}
