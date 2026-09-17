import "./styles/globals.css";

import { check } from "@tauri-apps/plugin-updater";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { toast } from "sonner";

import { hydrateRuntimeSecrets } from "./lib/api";
import { ensureDesktopTray } from "./lib/desktop-alerts";
import { applyTheme, getSettings } from "./lib/settings";
import { router } from "./router";

applyTheme(getSettings().theme);

async function notifyAvailableUpdate() {
  const update = await check();
  if (!update) return;
  toast.message(`IM Review ${update.version} is available`, {
    description: "Download now, then restart the app to finish updating.",
    duration: Infinity,
    action: {
      label: "Update",
      onClick: () => {
        void update
          .downloadAndInstall()
          .then(() => toast.success("Update installed — restart IM Review."))
          .catch(() => toast.error("Could not install the update."));
      },
    },
  });
}

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
  void notifyAvailableUpdate().catch(() => undefined);
}

void boot();
