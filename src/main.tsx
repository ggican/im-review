import "./styles/globals.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

import { hydrateRuntimeSecrets } from "./lib/api";
import { ensureDesktopTray } from "./lib/desktop-alerts";
import { applyTheme, getSettings } from "./lib/settings";
import { router } from "./router";

applyTheme(getSettings().theme);

async function boot() {
  try {
    await hydrateRuntimeSecrets();
  } catch (err) {
    console.warn("Failed to hydrate runtime secrets", err);
  }

  void ensureDesktopTray();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </React.StrictMode>,
  );
}

void boot();
