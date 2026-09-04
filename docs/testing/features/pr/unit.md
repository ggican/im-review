# Unit matrix — pr

Feature slug: `pr`  
Modules: `types.ts` helpers, `pr-cache.ts`  
Target: ≥90% lines on these files

| ID          | P   | Behavior                                                | Reference     | Status | Remaining risk |
| ----------- | --- | ------------------------------------------------------- | ------------- | ------ | -------------- |
| UNIT-PR-001 | P0  | `prKey` format `repo#number`                            | `types.ts`    | passed | —              |
| UNIT-PR-002 | P0  | `savedReviewToPullRequest` maps event + fromLocalReview | `types.ts`    | passed | —              |
| UNIT-PR-003 | P0  | `latestReviewsByPr` keeps newest submittedAt            | `types.ts`    | passed | —              |
| UNIT-PR-004 | P1  | Latest map ignores older duplicate keys                 | `types.ts`    | passed | —              |
| UNIT-PR-005 | P0  | `setPrCache` / `getPrCache` round-trip                  | `pr-cache.ts` | passed | —              |
| UNIT-PR-006 | P0  | `flattenPrCache` dedupes across tabs (review first)     | `pr-cache.ts` | passed | —              |
| UNIT-PR-007 | P1  | `subscribePrCache` notifies on set; unsubscribe stops   | `pr-cache.ts` | passed | —              |
| UNIT-PR-008 | P2  | Flatten empty lists → []                                | `pr-cache.ts` | passed | —              |

## Out of unit

`api.ts`, `ci-watch.ts`, drawers/rows/hooks (network / UI).
