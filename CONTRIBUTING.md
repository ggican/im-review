# Contributing

Thanks for helping improve IM Review.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Rust toolchain (for `pnpm tauri:dev` / desktop)

```bash
pnpm install
pnpm tauri:dev
```

After `pnpm install`, Husky installs git hooks (requires a git repo):

- `pre-commit` → lint-staged
- `commit-msg` → commitlint (Conventional Commits)

## Quality checks (required before PR)

```bash
pnpm check          # typecheck + eslint + prettier + unit tests
# or individually:
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:coverage  # optional coverage report
```

Auto-fix what you can:

```bash
pnpm lint:fix
pnpm format
```

Pre-commit runs **lint-staged** (ESLint + Prettier on staged files only).

Commit messages are checked by **commitlint** (Conventional Commits) via the `commit-msg` hook.

### Commit message format

```text
type(scope): short summary

Optional body explaining why.
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```text
feat(metrics): add p99 aggregation option
fix(settings): capture input value before setState
docs: document commit message rules
chore: bump vitest
```

Subject max **100** characters. Scope is optional.

## Unit tests

- Runner: **Vitest** (`happy-dom` for `localStorage`)
- Place tests next to code: `foo.ts` → `foo.test.ts`
- Shared fixtures: `src/test/fixtures.ts`
- Prefer pure logic (metrics, parsers, helpers) over UI/Tauri

```bash
pnpm test
pnpm test:watch
```

---

## Where to put code

Follow [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):

- Domain work → `src/features/<domain>/`
- Shared UI primitives → `src/components/ui/`
- Cross-cutting helpers → `src/lib/`
- OS / GitHub / AI commands → `src-tauri/`

## PR guidelines

1. Open an issue for larger changes (especially **metrics formulas** or **new AI providers**).
2. Keep secrets out of logs, screenshots, and commits.
3. Run `pnpm check` locally.
4. Metrics changes: update [docs/METRICS.md](docs/METRICS.md) in the same PR.
5. New AI providers: follow [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md).
6. Packaging / signing: see [docs/RELEASE.md](docs/RELEASE.md).

## Suggested editor setup

Install VS Code / Cursor recommendations from `.vscode/extensions.json` (ESLint, Prettier, rust-analyzer, Tauri). Format on save is enabled via `.vscode/settings.json`.
