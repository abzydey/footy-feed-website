import { createRequire } from "node:module";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);

// @capacitor-firebase/messaging marks `firebase` as an optional peer dep
// (it's only needed for the web platform, not native). Vite intercepts any
// import of an unresolved-looking optional peer dep and routes it through a
// synthetic `__vite-optional-peer-dep:...` stub module instead of the real
// package — and that stub doesn't proxy every named export the plugin
// actually imports (`isSupported` specifically), breaking the production
// build even though `firebase` is a real, always-installed dependency here
// (the pre-existing web push flow already imports it directly). Verified
// the real package does export it correctly (`firebase/messaging` re-
// exports `* from '@firebase/messaging'`, which has it) — this is purely
// Vite's stub failing to proxy that one export, not a genuine missing
// export. An explicit alias to the real resolved file bypasses Vite's
// optional-peer-dep interception entirely (alias resolution happens first).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "firebase/messaging": require.resolve("firebase/messaging"),
    },
  },
  server: {
    port: 5173,
    // Listen on all interfaces (not just localhost) so the dev server is
    // reachable from other devices on the same Wi-Fi, e.g. a phone.
    host: true,
  },
});
