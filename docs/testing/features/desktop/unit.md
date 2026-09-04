# UNIT — Desktop alerts

| ID               | Pri | Behavior                                                     | Reference           | Status | Remaining risk |
| ---------------- | --- | ------------------------------------------------------------ | ------------------- | ------ | -------------- |
| UNIT-DESKTOP-001 | P0  | `ensureDesktopTray` no-op outside Tauri                      | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-002 | P0  | `ensureDesktopTray` creates once; second call reuses promise | `desktop-alerts.ts` | passed | mock TrayIcon  |
| UNIT-DESKTOP-003 | P0  | `updateDesktopAlerts` no-op outside Tauri                    | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-004 | P0  | Badge + tooltip update; skip when unchanged                  | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-005 | P1  | Tray create errors warn; badge errors warn                   | `desktop-alerts.ts` | passed | —              |
