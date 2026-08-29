import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on all interfaces (not just localhost) so the dev server is
    // reachable from other devices on the same Wi-Fi, e.g. a phone.
    host: true,
  },
});
