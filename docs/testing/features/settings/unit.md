# Unit matrix — settings store

Feature slug: `settings`  
Module: `lib/settings.ts` (localStorage store APIs)  
Target: ≥90% lines on store mutations (theme DOM covered lightly)

| ID                | P   | Behavior                                                | Reference     | Status | Remaining risk         |
| ----------------- | --- | ------------------------------------------------------- | ------------- | ------ | ---------------------- |
| UNIT-SETTINGS-001 | P0  | `saveSettings` / `getSettings` persist + merge defaults | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-002 | P1  | Invalid `aiProvider` coerced to default on load path    | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-003 | P0  | Template upsert insert + update; delete                 | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-004 | P0  | Favorites toggle / remove / restore defaults            | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-005 | P0  | Favorite branch id + toggle + remove                    | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-006 | P0  | `saveReviewLocally` prepends and caps at 50             | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-007 | P1  | `deleteSavedReview` removes by id                       | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-008 | P1  | `subscribeSettings` notified on save; unsubscribe       | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-009 | P1  | `newTemplateId` unique-ish prefix                       | `settings.ts` | passed | —                      |
| UNIT-SETTINGS-010 | P2  | `applyTheme` toggles `dark` class for light/dark/system | `settings.ts` | passed | system media query env |
| UNIT-SETTINGS-011 | P2  | `isFavorite` / `isFavoriteBranch` boolean helpers       | `settings.ts` | passed | —                      |

## Out of unit

Settings page UI (`routes/settings.tsx`).
