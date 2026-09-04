import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const setBadgeCount = vi.fn().mockResolvedValue(undefined);
  const mockTray = { setTooltip: vi.fn().mockResolvedValue(undefined) };

  return {
    defaultWindowIcon: vi.fn().mockResolvedValue("icon"),
    MenuItem: { new: vi.fn().mockResolvedValue({ id: "show" }) },
    PredefinedMenuItem: { new: vi.fn().mockResolvedValue({}) },
    Menu: { new: vi.fn().mockResolvedValue({}) },
    TrayIcon: {
      removeById: vi.fn().mockRejectedValue(new Error("not found")),
      getById: vi.fn().mockResolvedValue(mockTray),
      new: vi.fn().mockResolvedValue({}),
    },
    getCurrentWindow: vi.fn().mockReturnValue({ setBadgeCount }),
    mockTray,
    setBadgeCount,
    isPermissionGranted: vi.fn().mockResolvedValue(true),
    requestPermission: vi.fn().mockResolvedValue("granted"),
    sendNotification: vi.fn(),
  };
});

vi.mock("@tauri-apps/api/app", () => ({
  defaultWindowIcon: mocks.defaultWindowIcon,
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: mocks.Menu,
  MenuItem: mocks.MenuItem,
  PredefinedMenuItem: mocks.PredefinedMenuItem,
}));

vi.mock("@tauri-apps/api/tray", () => ({
  TrayIcon: mocks.TrayIcon,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
}));

async function loadDesktopAlerts() {
  return import("./desktop-alerts");
}

function setTauri(present: boolean) {
  if (present) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
      writable: true,
    });
  } else {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  }
}

describe("UNIT-DESKTOP desktop-alerts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setTauri(false);

    mocks.defaultWindowIcon.mockResolvedValue("icon");
    mocks.MenuItem.new.mockResolvedValue({ id: "show" });
    mocks.PredefinedMenuItem.new.mockResolvedValue({});
    mocks.Menu.new.mockResolvedValue({});
    mocks.TrayIcon.removeById.mockRejectedValue(new Error("not found"));
    mocks.TrayIcon.getById.mockResolvedValue(mocks.mockTray);
    mocks.TrayIcon.new.mockResolvedValue({});
    mocks.setBadgeCount.mockResolvedValue(undefined);
    mocks.getCurrentWindow.mockReturnValue({
      setBadgeCount: mocks.setBadgeCount,
    });
    mocks.mockTray.setTooltip.mockResolvedValue(undefined);
    mocks.isPermissionGranted.mockResolvedValue(true);
    mocks.requestPermission.mockResolvedValue("granted");
  });

  it("UNIT-DESKTOP-001 ensureDesktopTray no-op outside Tauri", async () => {
    const { ensureDesktopTray } = await loadDesktopAlerts();

    await ensureDesktopTray();

    expect(mocks.TrayIcon.removeById).not.toHaveBeenCalled();
    expect(mocks.TrayIcon.new).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-002 ensureDesktopTray creates once; second call reuses promise", async () => {
    setTauri(true);
    mocks.TrayIcon.getById.mockResolvedValue(null);
    const { ensureDesktopTray } = await loadDesktopAlerts();

    const first = ensureDesktopTray();
    const second = ensureDesktopTray();

    expect(first).toBe(second);
    await first;

    expect(mocks.TrayIcon.removeById).toHaveBeenCalledTimes(1);
    expect(mocks.TrayIcon.removeById).toHaveBeenCalledWith("im-review-tray");
    expect(mocks.TrayIcon.new).toHaveBeenCalledTimes(1);
    expect(mocks.defaultWindowIcon).toHaveBeenCalledTimes(1);
    expect(mocks.Menu.new).toHaveBeenCalledTimes(1);

    await ensureDesktopTray();
    expect(mocks.TrayIcon.new).toHaveBeenCalledTimes(1);
  });

  it("UNIT-DESKTOP-002 skips TrayIcon.new when getById returns existing tray", async () => {
    setTauri(true);
    mocks.TrayIcon.getById.mockResolvedValue(mocks.mockTray);
    const { ensureDesktopTray } = await loadDesktopAlerts();

    await ensureDesktopTray();

    expect(mocks.TrayIcon.removeById).toHaveBeenCalledTimes(1);
    expect(mocks.TrayIcon.getById).toHaveBeenCalledWith("im-review-tray");
    expect(mocks.TrayIcon.new).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-003 updateDesktopAlerts no-op outside Tauri", async () => {
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 2, ciFailCount: 1 });

    expect(mocks.getCurrentWindow).not.toHaveBeenCalled();
    expect(mocks.TrayIcon.getById).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-004 updateDesktopAlerts sets badge and tooltip", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 2, ciFailCount: 1 });

    expect(mocks.setBadgeCount).toHaveBeenCalledWith(3);
    expect(mocks.mockTray.setTooltip).toHaveBeenCalledWith(
      "IM Review · 2 new PRs · 1 CI fail",
    );
  });

  it("UNIT-DESKTOP-004 updateDesktopAlerts clears badge when counts are zero", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });
    mocks.setBadgeCount.mockClear();
    mocks.mockTray.setTooltip.mockClear();

    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });

    expect(mocks.setBadgeCount).toHaveBeenCalledWith(undefined);
    expect(mocks.mockTray.setTooltip).toHaveBeenCalledWith("IM Review");
  });

  it("UNIT-DESKTOP-004 updateDesktopAlerts skips when badge and tooltip unchanged", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 2, ciFailCount: 0 });
    mocks.setBadgeCount.mockClear();
    mocks.mockTray.setTooltip.mockClear();

    await updateDesktopAlerts({ newCount: 2, ciFailCount: 0 });

    expect(mocks.setBadgeCount).not.toHaveBeenCalled();
    expect(mocks.mockTray.setTooltip).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-005 tray create errors warn via console.warn", async () => {
    setTauri(true);
    mocks.TrayIcon.getById.mockResolvedValue(null);
    const trayError = new Error("tray failed");
    mocks.TrayIcon.new.mockRejectedValue(trayError);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ensureDesktopTray } = await loadDesktopAlerts();

    await ensureDesktopTray();

    expect(warnSpy).toHaveBeenCalledWith("Tray unavailable", trayError);
    warnSpy.mockRestore();
  });

  it("UNIT-DESKTOP-005 badge errors warn via console.warn", async () => {
    setTauri(true);
    const badgeError = new Error("badge failed");
    mocks.setBadgeCount.mockRejectedValue(badgeError);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });

    expect(warnSpy).toHaveBeenCalledWith("Badge unavailable", badgeError);
    warnSpy.mockRestore();
  });

  it("UNIT-DESKTOP-006 skips notification on first baseline alert", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 2, ciFailCount: 1 });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-006 notifies when new PR count increases", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 3, ciFailCount: 0 });

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: "IM Review",
      body: "2 new PRs need attention",
    });
  });

  it("UNIT-DESKTOP-006 notifies when CI fail count increases", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 0, ciFailCount: 2 });

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: "IM Review",
      body: "2 CI fails on your PRs",
    });
  });

  it("UNIT-DESKTOP-006 requests permission when not granted", async () => {
    setTauri(true);
    mocks.isPermissionGranted.mockResolvedValue(false);
    mocks.requestPermission.mockResolvedValue("granted");
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });

    expect(mocks.requestPermission).toHaveBeenCalled();
    expect(mocks.sendNotification).toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-006 skips notify when permission denied", async () => {
    setTauri(true);
    mocks.isPermissionGranted.mockResolvedValue(false);
    mocks.requestPermission.mockResolvedValue("denied");
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });

    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-007 tray click and Show menu open the window", async () => {
    setTauri(true);
    mocks.TrayIcon.getById.mockResolvedValue(null);
    const show = vi.fn().mockResolvedValue(undefined);
    const setFocus = vi.fn().mockResolvedValue(undefined);
    const unminimize = vi.fn().mockResolvedValue(undefined);
    mocks.getCurrentWindow.mockReturnValue({
      setBadgeCount: mocks.setBadgeCount,
      show,
      setFocus,
      unminimize,
    });

    let menuAction: (() => void) | undefined;
    let trayAction:
      ((event: { type: string; button: string }) => void) | undefined;
    mocks.MenuItem.new.mockImplementation(
      async (opts: { action?: () => void }) => {
        menuAction = opts.action;
        return { id: "show" };
      },
    );
    mocks.TrayIcon.new.mockImplementation(
      async (opts: {
        action?: (event: { type: string; button: string }) => void;
      }) => {
        trayAction = opts.action;
        return {};
      },
    );

    const { ensureDesktopTray } = await loadDesktopAlerts();
    await ensureDesktopTray();

    menuAction?.();
    await Promise.resolve();
    expect(show).toHaveBeenCalled();

    show.mockClear();
    trayAction?.({ type: "Click", button: "Left" });
    await Promise.resolve();
    expect(show).toHaveBeenCalled();
  });

  it("UNIT-DESKTOP-007 handles notification permission and send errors", async () => {
    setTauri(true);
    mocks.isPermissionGranted.mockRejectedValue(new Error("perm boom"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { updateDesktopAlerts } = await loadDesktopAlerts();

    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 1, ciFailCount: 0 });
    expect(warnSpy).toHaveBeenCalledWith(
      "Notification permission unavailable",
      expect.any(Error),
    );

    vi.resetModules();
    mocks.isPermissionGranted.mockResolvedValue(true);
    mocks.sendNotification.mockImplementation(() => {
      throw new Error("notify boom");
    });
    const { updateDesktopAlerts: update2 } = await loadDesktopAlerts();
    await update2({ newCount: 0, ciFailCount: 0 });
    await update2({ newCount: 1, ciFailCount: 1 });
    expect(warnSpy).toHaveBeenCalledWith(
      "Notification unavailable",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it("UNIT-DESKTOP-007 uses singular notification copy", async () => {
    setTauri(true);
    const { updateDesktopAlerts } = await loadDesktopAlerts();
    await updateDesktopAlerts({ newCount: 0, ciFailCount: 0 });
    await updateDesktopAlerts({ newCount: 1, ciFailCount: 1 });
    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: "IM Review",
      body: "1 new PR need attention · 1 CI fail on your PRs",
    });
  });
});
