import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const TRAY_ID = "im-review-tray";

/** In-flight / completed init — prevents StrictMode double-mount creating 2 trays. */
let trayInit: Promise<void> | null = null;
let lastBadge: number | null = null;
let lastTooltip = "";
/** `null` until first alert update — avoid notify on cold start. */
let lastNotifiedNew: number | null = null;
let lastNotifiedCi: number | null = null;
let permissionWarmup: Promise<boolean> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function showMainWindow() {
  const win = getCurrentWindow();
  await win.show();
  await win.setFocus();
  await win.unminimize();
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (!permissionWarmup) {
    permissionWarmup = (async () => {
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
        return granted;
      } catch (err) {
        console.warn("Notification permission unavailable", err);
        return false;
      }
    })();
  }
  return permissionWarmup;
}

async function notifyIfIncreased(input: {
  newCount: number;
  ciFailCount: number;
}): Promise<void> {
  const { newCount, ciFailCount } = input;

  if (lastNotifiedNew === null || lastNotifiedCi === null) {
    lastNotifiedNew = newCount;
    lastNotifiedCi = ciFailCount;
    return;
  }

  const newDelta = newCount - lastNotifiedNew;
  const ciDelta = ciFailCount - lastNotifiedCi;
  lastNotifiedNew = newCount;
  lastNotifiedCi = ciFailCount;

  if (newDelta <= 0 && ciDelta <= 0) return;
  if (!(await ensureNotificationPermission())) return;

  const parts: string[] = [];
  if (newDelta > 0) {
    parts.push(`${newDelta} new PR${newDelta === 1 ? "" : "s"} need attention`);
  }
  if (ciDelta > 0) {
    parts.push(`${ciDelta} CI fail${ciDelta === 1 ? "" : "s"} on your PRs`);
  }

  try {
    sendNotification({
      title: "IM Review",
      body: parts.join(" · "),
    });
  } catch (err) {
    console.warn("Notification unavailable", err);
  }
}

async function createTrayOnce(): Promise<void> {
  try {
    // Drop a leftover tray from HMR / prior race so we never stack icons.
    try {
      await TrayIcon.removeById(TRAY_ID);
    } catch {
      // none yet
    }

    const existing = await TrayIcon.getById(TRAY_ID);
    if (existing) return;

    const icon = await defaultWindowIcon();
    const showItem = await MenuItem.new({
      id: "show",
      text: "Show IM Review",
      action: () => {
        void showMainWindow();
      },
    });
    const sep = await PredefinedMenuItem.new({ item: "Separator" });
    const quit = await PredefinedMenuItem.new({ item: "Quit" });
    const menu = await Menu.new({ items: [showItem, sep, quit] });

    await TrayIcon.new({
      id: TRAY_ID,
      icon: icon ?? undefined,
      tooltip: "IM Review",
      menu,
      action: (event) => {
        if (event.type === "Click" && event.button === "Left") {
          void showMainWindow();
        }
      },
    });

    // Warm permission early so first background alert can notify.
    void ensureNotificationPermission();
  } catch (err) {
    console.warn("Tray unavailable", err);
  }
}

/** Create tray once (Show + Quit). Safe under React StrictMode / remounts. */
export function ensureDesktopTray(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  if (!trayInit) {
    trayInit = createTrayOnce();
  }
  return trayInit;
}

export async function updateDesktopAlerts(input: {
  newCount: number;
  ciFailCount: number;
}): Promise<void> {
  if (!isTauri()) return;

  const badge =
    input.newCount + input.ciFailCount > 0
      ? input.newCount + input.ciFailCount
      : undefined;

  if (badge !== lastBadge) {
    lastBadge = badge ?? null;
    try {
      const win = getCurrentWindow();
      await win.setBadgeCount(badge);
    } catch (err) {
      console.warn("Badge unavailable", err);
    }
  }

  const parts: string[] = ["IM Review"];
  if (input.newCount > 0) {
    parts.push(`${input.newCount} new PR${input.newCount === 1 ? "" : "s"}`);
  }
  if (input.ciFailCount > 0) {
    parts.push(
      `${input.ciFailCount} CI fail${input.ciFailCount === 1 ? "" : "s"}`,
    );
  }
  const tooltip = parts.join(" · ");
  if (tooltip !== lastTooltip) {
    lastTooltip = tooltip;
    try {
      const tray = await TrayIcon.getById(TRAY_ID);
      await tray?.setTooltip(tooltip);
    } catch {
      // tray may not exist yet
    }
  }

  await notifyIfIncreased(input);
}
