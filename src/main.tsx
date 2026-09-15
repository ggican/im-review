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
      <Toaster
        theme="system"
        position="top-right"
        closeButton
        gap={10}
        toastOptions={{
          classNames: {
            toast: "im-toast",
            title: "im-toast-title",
            description: "im-toast-description",
            success: "im-toast-success",
            error: "im-toast-error",
            warning: "im-toast-warning",
            info: "im-toast-info",
            closeButton: "im-toast-close",
            actionButton: "im-toast-action",
            cancelButton: "im-toast-cancel",
          },
        }}
      />
    </React.StrictMode>,
  );
}

void boot();
