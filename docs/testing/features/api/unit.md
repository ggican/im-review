# UNIT — API / fetch / CI watch

| ID           | Pri | Behavior                                                                | Reference          | Status | Remaining risk |
| ------------ | --- | ----------------------------------------------------------------------- | ------------------ | ------ | -------------- |
| UNIT-API-001 | P0  | `hydrateRuntimeSecrets` invokes Tauri with local payload                | `lib/api.ts`       | passed | mock invoke    |
| UNIT-API-002 | P0  | save/has/delete token hydrate + localStorage                            | `lib/api.ts`       | passed | —              |
| UNIT-API-003 | P0  | AI key save/has/delete/validate/list status                             | `lib/api.ts`       | passed | —              |
| UNIT-API-004 | P1  | Deprecated cursor* wrappers call AI methods                             | `lib/api.ts`       | passed | —              |
| UNIT-API-005 | P0  | `githubGet` / `githubRequest` / `aiReviewPr` / `aiRefineReview` invoke  | `lib/api.ts`       | passed | —              |
| UNIT-API-006 | P0  | `metricsWindowFrom` ISO date offset                                     | `pr/api.ts`        | passed | clock          |
| UNIT-API-007 | P0  | Search mappers: assigned / review / mine / authored / reviewed / merged | `pr/api.ts`        | passed | mock githubGet |
| UNIT-API-008 | P0  | `fetchPrDetail` maps merged/closed/open + CI description                | `pr/api.ts`        | passed | —              |
| UNIT-API-009 | P0  | `fetchPrCiChecks` merges statuses + check runs; overall ranks           | `pr/api.ts`        | passed | —              |
| UNIT-API-010 | P0  | `fetchPrReviews` filters PENDING; latestByUser; inlineCount             | `pr/api.ts`        | passed | —              |
| UNIT-API-011 | P0  | `submitReview` requires body/comments for COMMENT/REQUEST_CHANGES       | `pr/api.ts`        | passed | —              |
| UNIT-API-012 | P1  | `postIssueComment` rejects empty; close/reopen/ready/draft              | `pr/api.ts`        | passed | —              |
| UNIT-API-013 | P1  | `fetchHeadBranch` uses cache or fetches; invalid repo throws            | `pr/api.ts`        | passed | —              |
| UNIT-API-014 | P1  | `fetchPrCommitCount` length; GraphQL draft errors surface               | `pr/api.ts`        | passed | —              |
| UNIT-API-015 | P0  | `scanMineCiFailures` only failures; ignores drafts/errors; sorts        | `pr/ci-watch.ts`   | passed | —              |
| UNIT-API-016 | P0  | `fetchAllRepos` pages until short page / empty                          | `repos/api.ts`     | passed | —              |
| UNIT-API-017 | P0  | `buildMetricsWindow` / `buildDailyActivity` / `fetchEngineerMetrics`    | `metrics/fetch.ts` | passed | —              |
| UNIT-API-018 | P1  | Enrich authored includes CI when enabled; reviewed enrich               | `metrics/fetch.ts` | passed | —              |
