# Extended unit matrices (full app surface)

Hermetic tests with mocks for network/Tauri/React. Goal: ≥90% lines on all `src/**/*.{ts,tsx}` except `vite-env.d.ts` and test fixtures.

See also existing matrices: [metrics](./metrics/unit.md), [ai-review](./ai-review/unit.md), [pr](./pr/unit.md), [lib](./lib/unit.md), [settings](./settings/unit.md).

## New / expanded feature matrices

- [api/unit.md](./api/unit.md) — `lib/api`, `pr/api`, `repos/api`, `metrics/fetch`, `ci-watch`
- [hooks/unit.md](./hooks/unit.md) — PR / metrics / repos / settings hooks
- [desktop/unit.md](./desktop/unit.md) — tray / badge
- [ui/unit.md](./ui/unit.md) — components, panels, routes, router, command palette

## Commands

```bash
pnpm test
pnpm test:coverage
```
