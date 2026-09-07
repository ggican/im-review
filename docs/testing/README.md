# IM Review unit testing strategy

## Goal

Hermetic **unit** coverage ≥ **95% lines** (statements ≥94%) across the app TypeScript surface (`src/**/*.{ts,tsx}`), with network/Tauri mocked. No real credentials.

## In scope

| Area        | Modules                                                                |
| ----------- | ---------------------------------------------------------------------- |
| Pure logic  | metrics stats/score/suggestions, AI diff/parse, PR helpers, lib stores |
| API / fetch | `lib/api`, `pr/api`, `repos/api`, `metrics/fetch`, `ci-watch`          |
| Hooks       | `use-settings`, `pr/hooks`, `metrics/hooks`, `repos/hooks`             |
| Desktop     | `desktop-alerts` (mocked Tauri)                                        |
| UI          | components, panels, routes, router, command palette (RTL + mocks)      |

## Excluded from coverage %

- `src/vite-env.d.ts`, `src/test/**`, `*.test.*`
- `src/main.tsx` (boot side-effects; covered indirectly via modules it calls)

## Conventions

- Test IDs: `UNIT-<FEATURE>-NNN` (stable)
- Priority: P0–P3; status `planned` → `passed` only after green run
- Colocate: `foo.ts` → `foo.test.ts` / `foo.test.tsx`
- Fixtures: `src/test/fixtures.ts`; setup: `src/test/setup.ts`

## Commands

```bash
pnpm test              # vitest + scripts/*.test.mjs (Cursor runtime prepare)
pnpm test:coverage
pnpm check
```

## Latest verification (2026-09-07)

- `pnpm test` → vitest + `scripts/prepare-cursor-runtime.test.mjs`
- `pnpm test:coverage` → lines/statements thresholds in `vite.config.ts`
- CI uploads `coverage/lcov.info` to Coveralls; Rust job runs `cargo check` / `clippy` / `cargo test` (includes Cursor runtime path resolver tests)

## Feature matrices

- [features/README.md](./features/README.md) — index
- metrics · ai-review · pr · lib · settings · api · hooks · desktop · ui
