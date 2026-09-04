# Unit matrix — lib

Feature slug: `lib`  
Modules: `seen.ts`, `secrets.ts`, `time.ts`, `cn.ts`  
Target: ≥90% lines on these files

| ID           | P   | Behavior                                             | Reference    | Status | Remaining risk |
| ------------ | --- | ---------------------------------------------------- | ------------ | ------ | -------------- |
| UNIT-LIB-001 | P0  | `ensureLastSeenSeeded` idempotent                    | `seen.ts`    | passed | —              |
| UNIT-LIB-002 | P0  | `isPrNew` / `countNewPrs` vs watermark               | `seen.ts`    | passed | —              |
| UNIT-LIB-003 | P0  | `markAllSeen` updates snapshot                       | `seen.ts`    | passed | —              |
| UNIT-LIB-004 | P1  | Invalid lastSeen / invalid dates → not new           | `seen.ts`    | passed | —              |
| UNIT-LIB-005 | P1  | `subscribeLastSeen` fires on mark; unsubscribe works | `seen.ts`    | passed | —              |
| UNIT-LIB-006 | P2  | `getLastSeenSnapshot` matches `getLastSeenAt`        | `seen.ts`    | passed | —              |
| UNIT-LIB-007 | P0  | GitHub token set/get/clear/has + trim                | `secrets.ts` | passed | —              |
| UNIT-LIB-008 | P0  | AI key set/get/clear/has + hydrate payload           | `secrets.ts` | passed | —              |
| UNIT-LIB-009 | P1  | `listAiKeysLocal` only providers with keys           | `secrets.ts` | passed | —              |
| UNIT-LIB-010 | P2  | Empty/whitespace token treated as absent             | `secrets.ts` | passed | —              |
| UNIT-LIB-011 | P0  | `relativeTime` just now / m / h / d                  | `time.ts`    | passed | —              |
| UNIT-LIB-012 | P1  | `relativeTime` months bucket + invalid → ""          | `time.ts`    | passed | —              |
| UNIT-LIB-013 | P0  | `cn` merges conflicting Tailwind classes             | `cn.ts`      | passed | —              |
| UNIT-LIB-014 | P2  | `cn` falsy inputs ignored                            | `cn.ts`      | passed | —              |

## Out of unit

`desktop-alerts.ts`, `api.ts`, `use-settings.ts` (React).
