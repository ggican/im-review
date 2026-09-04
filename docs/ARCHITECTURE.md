# Architecture & code structure

How IM Review is organized so contributors know where new code belongs.

## Layers

```text
src/
  routes/              Thin page entry points (wired in router.tsx)
  features/<domain>/   Domain UI + API + hooks + types for one product area
  components/
    ui/                Reusable primitives (Button, Input, Dialog, …)
    layout/            Page shell / header / brand
  lib/                 Cross-cutting helpers (settings, secrets, api, seen, …)
  styles/              Global CSS
src-tauri/
  src/commands.rs      Rust commands (GitHub HTTP, AI, secrets hydrate)
  capabilities/        Tauri ACL permissions
docs/                  Product / metrics / release docs
scripts/               Node helpers (e.g. Cursor SDK bridge)
```

## Rules of thumb

| Put it here      | When                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| `features/<x>/`  | Logic + UI that belong to one domain (PR lists, metrics, repos, AI draft) |
| `routes/*.tsx`   | Route-level page that composes features; keep thin when possible          |
| `components/ui/` | Generic, domain-agnostic UI only                                          |
| `lib/`           | Shared utilities used by 2+ features (settings store, time, cn)           |
| `src-tauri/`     | Anything that needs OS secrets, shell, or privileged HTTP                 |

### Preferred feature layout

```text
features/pr/
  api.ts       GitHub / domain fetchers
  types.ts     Domain types
  hooks.ts     React data hooks
  *Panel.tsx   Presentational / interactive pieces
  PRList.tsx   Feature screens used by routes
```

### Routes vs features

- **Thin routes** (good): `routes/repos.tsx` → re-exports `features/repos/ReposPage`
- **Fat routes** (ok for now, split when touching): `routes/ai-review.tsx`, `routes/settings.tsx`

When you next edit a fat route heavily, extract panels into `features/<domain>/` and leave the route as glue (params, navigation, page title).

## Naming

- React components: `PascalCase.tsx`
- Hooks / modules: `camelCase.ts` (`hooks.ts`, `use-settings.ts`)
- Prefer `@/` imports over deep relative paths

## Quality gates

See [CONTRIBUTING.md](../CONTRIBUTING.md). CI runs typecheck, ESLint, and Prettier on every PR.

## Unit tests

Prefer pure modules under `features/*/`, `lib/`. Colocate as `*.test.ts`. Fixtures in `src/test/fixtures.ts`. Run with `pnpm test`.

## Do not

- Put GitHub PAT / AI keys in source or docs samples
- Add new top-level folders under `src/` without a clear layer reason
- Import from `routes/` into `features/` (dependency should flow routes → features → lib)
