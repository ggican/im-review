# UNIT — Desktop alerts

| ID               | Pri | Behavior                                                     | Reference           | Status | Remaining risk |
| ---------------- | --- | ------------------------------------------------------------ | ------------------- | ------ | -------------- |
| UNIT-DESKTOP-001 | P0  | `ensureDesktopTray` no-op outside Tauri                      | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-002 | P0  | `ensureDesktopTray` creates once; second call reuses promise | `desktop-alerts.ts` | passed | mock TrayIcon  |
| UNIT-DESKTOP-003 | P0  | `updateDesktopAlerts` no-op outside Tauri                    | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-004 | P0  | Badge + tooltip update; skip when unchanged                  | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-005 | P1  | Tray create errors warn; badge errors warn                   | `desktop-alerts.ts` | passed | —              |
| UNIT-DESKTOP-006 | P0  | Notify on new PR / CI increase; skip baseline & denied       | `desktop-alerts.ts` | passed | mock plugin    |
| UNIT-DESKTOP-007 | P1  | Tray click/Show; permission & sendNotification errors        | `desktop-alerts.ts` | passed | —              |

Close (red button) hides to tray in Rust (`lib.rs`); Quit from tray exits. Dock click restores when hidden.
