import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/push";

// Fire-and-forget: a registration failure shouldn't block rendering, and
// enablePushNotifications() re-checks/re-registers on its own if this
// hasn't resolved yet by the time someone opts into notifications.
registerServiceWorker()?.catch((err) => console.error("[push] service worker registration failed:", err));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
