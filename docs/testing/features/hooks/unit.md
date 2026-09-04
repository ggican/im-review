# UNIT — Hooks

| ID             | Pri | Behavior                                                                  | Reference          | Status | Remaining risk |
| -------------- | --- | ------------------------------------------------------------------------- | ------------------ | ------ | -------------- |
| UNIT-HOOKS-001 | P0  | `useSettings` / templates / favorites / branches / savedReviews subscribe | `use-settings.ts`  | passed | —              |
| UNIT-HOOKS-002 | P0  | `useMyPRs` loads when enabled; sets cache; surfaces error                 | `pr/hooks.ts`      | passed | —              |
| UNIT-HOOKS-003 | P1  | `useMyPRs` skips fetch when disabled; interval refresh                    | `pr/hooks.ts`      | passed | fake timers    |
| UNIT-HOOKS-004 | P0  | `useMetrics` validates token + loads scorecard/suggestions                | `metrics/hooks.ts` | passed | —              |
| UNIT-HOOKS-005 | P1  | `useMetrics` error path; disabled no fetch                                | `metrics/hooks.ts` | passed | —              |
| UNIT-HOOKS-006 | P0  | `useRepos` load / error / favorites filter                                | `repos/hooks.ts`   | passed | —              |
