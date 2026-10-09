import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/push";
import { isNativeApp } from "./lib/platform";
import { watchSystemTheme } from "./lib/theme";

// Lets index.css apply app-only touches (no long-press link previews etc.).
if (isNativeApp) document.documentElement.classList.add("native");

// Fire-and-forget: a registration failure shouldn't block rendering, and
// enablePushNotifications() re-checks/re-registers on its own if this
// hasn't resolved yet by the time someone opts into notifications.
registerServiceWorker()?.catch((err) => console.error("[push] service worker registration failed:", err));

watchSystemTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
