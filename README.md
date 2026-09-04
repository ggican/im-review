# <img src="public/im-review-logo.png" alt="" width="36" height="36" /> IM Review

[![CI](https://github.com/ggican/im-review/actions/workflows/ci.yml/badge.svg)](https://github.com/ggican/im-review/actions/workflows/ci.yml)
[![Release](https://github.com/ggican/im-review/actions/workflows/release.yml/badge.svg)](https://github.com/ggican/im-review/actions/workflows/release.yml)
[![Coverage Status](https://coveralls.io/repos/github/ggican/im-review/badge.svg?branch=main)](https://coveralls.io/github/ggican/im-review?branch=main)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/code_style-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/code_style-Prettier-ff69b4?logo=prettier&logoColor=white)](https://prettier.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Desktop app for **GitHub PR triage**, **AI-assisted review** (human confirms before submit), and an **engineering metrics scorecard**.

Built with **Tauri 2 + React + TypeScript**. After install, paste a GitHub PAT on first launch — no OAuth app registration, no macOS Keychain prompt. Tokens stay in local app storage (never committed to git).

---

## Why IM Review?

Reviewing PRs across many repos is slow: GitHub tabs, clone/setup, noisy notifications, and AI tools that auto-post comments.

IM Review helps you:

| Benefit                     | What you get                                                                      |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Faster triage**           | Assigned / review-requested / my open PRs in one desktop queue                    |
| **Favorites focus**         | Filter to the repos that matter                                                   |
| **AI draft, not auto-post** | Patch-based AI review → you edit → then submit to GitHub                          |
| **Multi-AI keys**           | Use Cursor, OpenAI, Anthropic (Claude), Gemini, or OpenAI Codex-compatible keys   |
| **No clone by default**     | Reviews run from GitHub patch text                                                |
| **Own-PR controls**         | Close or convert your PR to draft from the app                                    |
| **Scorecard + coaching**    | Last N days Speed / Quality / Throughput / Collaboration + actionable suggestions |
| **CI health**               | Jenkins/GitHub check summary without leaving the app                              |

### Advantages vs “just GitHub + ChatGPT”

1. **Review loop stays in one place** — list → open → draft → submit → local history.
2. **Human gate** — AI never posts without confirmation.
3. **Secrets stay local** — PAT and AI keys in local app storage (not uploaded to our servers).
4. **Metrics you can audit** — raw values + published formulas (see [docs/METRICS.md](docs/METRICS.md)).
5. **Bring your own model** — pick the AI provider you already pay for.

---

## Features (current)

- GitHub PAT auth on first launch (local storage; no OAuth app setup)
- PR lists: Assigned, Review requested, My open
- Favorite repos & branches
- PR detail: description, files + diffs, CI/Jenkins checks, current reviews
- Quick approve (LGTM) and full AI draft review with refine chips
- Submit APPROVE / COMMENT / REQUEST_CHANGES with optional inline comments
- ⌘K / Ctrl+K command palette to jump to PRs, repos, and pages
- “New” badges for PRs updated since you last marked seen (+ dock badge)
- Tray icon + CI failure banner for your authored open PRs
- Metrics scorecard (Today / 7 / 14 / 30 days) with aggregation (Average, P50–P99)
- Suggestions tab to raise scores (review / merge / fix CI / split)
- Close / draft / reopen for PRs you authored

---

## Requirements

- **macOS** (primary; Windows/Linux via Tauri possible)
- **Node.js 20+** and **pnpm**
- **Rust** toolchain ([rustup](https://rustup.rs/)) for Tauri
- **GitHub Personal Access Token** with at least `repo` + `read:user`
- Optional: API key for one AI provider (Cursor / OpenAI / Anthropic / Gemini / Codex)

---

## Install & run (development)

```bash
git clone https://github.com/ikhsanmahendri/im-review.git
cd im-review
pnpm install
pnpm tauri:dev
```

> If your fork/org differs, change the clone URL accordingly.

First launch:

1. Open the app → onboarding asks for a **GitHub Personal Access Token** (paste only — no “Login with GitHub” OAuth app registration needed).
2. Open **Settings** → add at least one **AI provider API key** (optional until you use AI review).
3. Prefer **Favorites** on the dashboard for a quieter queue.

### Auth note (PAT vs OAuth)

| Approach                  | Needs GitHub App registration? | User experience                   |
| ------------------------- | ------------------------------ | --------------------------------- |
| **PAT paste (current)**   | No                             | First screen: paste `ghp_…` token |
| OAuth “Login with GitHub” | Yes (OAuth App + callback URL) | One-click browser login           |

IM Review uses **PAT paste** so anyone can install the open-source app without you hosting a registered GitHub OAuth App.

### Useful scripts

```bash
pnpm tauri:dev         # desktop app (dev)
pnpm tauri:build       # production .app + .dmg
pnpm build             # frontend typecheck + Vite build
pnpm exec tsc --noEmit # TypeScript only
```

### Production build (macOS)

```bash
pnpm tauri:build
```

Artifacts land under `src-tauri/target/release/bundle/` (`.app` and `.dmg`).

Local builds use **ad-hoc signing** by default. For Gatekeeper-friendly distribution (Developer ID + notarization), see **[docs/RELEASE.md](docs/RELEASE.md)**.

---

## AI providers

IM Review supports multiple AI backends for **draft** review (still human-confirmed):

| Provider               | Typical key prefix / source       | Notes                                                    |
| ---------------------- | --------------------------------- | -------------------------------------------------------- |
| **Cursor**             | Cursor Dashboard → Integrations   | Local Cursor SDK path                                    |
| **OpenAI**             | `sk-...` from platform.openai.com | Chat Completions API                                     |
| **Codex**              | OpenAI key (Codex / GPT models)   | Same OpenAI-compatible HTTP path; pick Codex in Settings |
| **Anthropic (Claude)** | `sk-ant-...`                      | Messages API                                             |
| **Gemini**             | Google AI Studio key              | Generative Language API                                  |

Add keys in **Settings → AI providers**. Choose the **active provider** used for “Run AI review”.

See [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) for setup details and how to contribute a new provider.

---

## Metrics

Scorecard weights (Overall):

```text
Overall = 25% Speed + 40% Throughput + 15% Quality + 20% Collaboration
```

Formulas, bands, aggregation (Average / percentiles), and how to propose better scoring live in:

→ **[docs/METRICS.md](docs/METRICS.md)**

Contributions to make the formulas more “patent / industry-aligned” are welcome — document changes there first.

---

## Security

- GitHub PAT and AI keys: **local app storage** (webview `localStorage`), hydrated into Rust memory at runtime
- Prefer a private machine; clear tokens via Settings → Reconnect / Remove key if the device is shared
- Never commit secrets; AI drafts do **not** auto-post to GitHub
- Prefer fine-scoped PATs; rotate if leaked

> Note: local storage is more convenient than macOS Keychain (no password prompts) but weaker against malware on a shared computer. For most personal desktop installs this is a good trade-off.

---

## Project layout

```text
src/routes/          Page entry (router)
src/features/        Domain modules (pr, metrics, repos, ai-review, …)
src/components/      Shared UI + layout
src/lib/             Cross-cutting helpers
src-tauri/           Tauri + Rust commands
docs/                Product & contributor docs
CONTRIBUTING.md      How to contribute + quality gates
docs/ARCHITECTURE.md Code structure conventions
```

Full conventions: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)**. Short version:

1. `pnpm install` then `pnpm check` (typecheck + lint + format + tests) before opening a PR.
2. Keep secrets out of logs and commits.
3. Metrics / AI provider / release docs as linked there.
4. Unit matrices live in [docs/testing/](docs/testing/README.md).

---

## License

[MIT](LICENSE) © Ikhsan Mahendri

---

## Disclaimer

Engineering scores are **heuristics** for personal coaching, not HR evaluations. AI review suggestions can be wrong — always read the diff yourself before submitting.
