# UNIT — UI / routes / panels

Smoke + interaction tests with mocked hooks/API. Not full E2E.

| ID | Pri | Behavior | Reference | Status | Remaining risk |
| --- | --- | --- | --- | --- | --- |
| UNIT-UI-001 | P0 | UI primitives render (button, input, textarea, select, dialog) | `components/ui/*` | passed | — |
| UNIT-UI-002 | P0 | `PageShell` renders title + children | `PageShell.tsx` | passed | — |
| UNIT-UI-003 | P0 | Router loaders redirect when unauthenticated / authed | `router.tsx` | passed | — |
| UNIT-UI-004 | P0 | Onboarding validates token path (mocked) | `onboarding.tsx` | passed | — |
| UNIT-UI-005 | P0 | Dashboard renders tabs + new banner with mocked PRs | `dashboard.tsx` | passed | — |
| UNIT-UI-006 | P1 | Metrics / Repos route wrappers render page | `routes/*` | passed | — |
| UNIT-UI-007 | P0 | Settings tabs render; theme/token fields present | `settings.tsx` | passed | heavy |
| UNIT-UI-008 | P0 | AI review page loads with mocked PR detail | `ai-review.tsx` | passed | heavy |
| UNIT-UI-009 | P1 | PRList / PRRow / drawer / panels render fixtures | `features/pr/*` | passed | — |
| UNIT-UI-010 | P1 | Metrics panels / charts / cards render fixtures | `features/metrics/*` | passed | — |
| UNIT-UI-011 | P1 | ReposPage / RepoRow / AiReviewPanel / CommandPalette | various | passed | — |
| UNIT-UI-012 | P2 | DeltaBadge / MetricSummaryBanner edge labels | metrics UI | passed | — |
