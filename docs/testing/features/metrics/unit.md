# Unit matrix — metrics

Feature slug: `metrics`  
Modules: `stats.ts`, `score.ts`, `suggestions.ts`, `types.ts`  
Target: ≥90% lines on these files

| ID               | P   | Behavior                                                       | Reference        | Status | Remaining risk |
| ---------------- | --- | -------------------------------------------------------------- | ---------------- | ------ | -------------- |
| UNIT-METRICS-001 | P0  | `average` empty → 0; non-empty mean                            | `stats.ts`       | passed | —              |
| UNIT-METRICS-002 | P0  | `percentile` single, interpolate, endpoints                    | `stats.ts`       | passed | —              |
| UNIT-METRICS-003 | P0  | `aggregate` null empty; avg + p50–p99                          | `stats.ts`       | passed | —              |
| UNIT-METRICS-004 | P1  | `aggregationLabel` all modes                                   | `stats.ts`       | passed | —              |
| UNIT-METRICS-005 | P0  | `scoreTrend` null prev, zero prev, % delta                     | `stats.ts`       | passed | —              |
| UNIT-METRICS-006 | P0  | `computeScorecard` weights 25/40/15/20; overall 0–100          | `score.ts`       | passed | —              |
| UNIT-METRICS-007 | P0  | Empty authored/reviewed still returns full metric rows         | `score.ts`       | passed | —              |
| UNIT-METRICS-008 | P1  | Fast cycle times score higher than slow                        | `score.ts`       | passed | —              |
| UNIT-METRICS-009 | P1  | Unreviewed merges lower quality than reviewed                  | `score.ts`       | passed | —              |
| UNIT-METRICS-010 | P1  | Ideal PR size band vs oversized                                | `score.ts`       | passed | —              |
| UNIT-METRICS-011 | P1  | `computeTrends` wires all categories                           | `score.ts`       | passed | —              |
| UNIT-METRICS-012 | P0  | `buildCiHealthSummary` counts pass/fail/pending + top contexts | `score.ts`       | passed | —              |
| UNIT-METRICS-013 | P1  | CI summary ignores empty snapshots; sorts failing PRs          | `score.ts`       | passed | —              |
| UNIT-METRICS-014 | P1  | `windowPresetDays` today→1, 7/14/30                            | `types.ts`       | passed | —              |
| UNIT-METRICS-015 | P0  | Suggestions: review queue when collab low                      | `suggestions.ts` | passed | —              |
| UNIT-METRICS-016 | P0  | Suggestions: split large open PR when quality low              | `suggestions.ts` | passed | —              |
| UNIT-METRICS-017 | P1  | Suggestions: fix_ci for aging open PR with failed CI           | `suggestions.ts` | passed | —              |
| UNIT-METRICS-018 | P1  | Suggestions: merge / follow_up aging open PR                   | `suggestions.ts` | passed | —              |
| UNIT-METRICS-019 | P1  | Suggestions: request review on unreviewed open                 | `suggestions.ts` | passed | —              |
| UNIT-METRICS-020 | P1  | Suggestions: throughput ship when volume thin                  | `suggestions.ts` | passed | —              |
| UNIT-METRICS-021 | P2  | Suggestions cap ≤8 and dedupe by id                            | `suggestions.ts` | passed | —              |
| UNIT-METRICS-022 | P2  | Suggestions: find reviews when collab low & queue empty        | `suggestions.ts` | passed | —              |
| UNIT-METRICS-023 | P2  | Scorecard with p90 aggregation differs from avg                | `score.ts`       | passed | —              |
| UNIT-METRICS-024 | P2  | Coding-time variance / CV path with ≥2 cycles                  | `score.ts`       | passed | —              |

## Out of unit

Hooks/fetch/UI panels — see strategy README.
