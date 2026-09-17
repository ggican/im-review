# <img src="public/im-review-logo.png" alt="" width="36" height="36" /> IM Review

[![CI](https://github.com/ggican/im-review/actions/workflows/ci.yml/badge.svg)](https://github.com/ggican/im-review/actions/workflows/ci.yml)
[![Release](https://github.com/ggican/im-review/actions/workflows/release.yml/badge.svg?branch=v0.1.16)](https://github.com/ggican/im-review/actions/workflows/release.yml)
[![Latest](https://img.shields.io/github/v/release/ggican/im-review?label=download)](https://github.com/ggican/im-review/releases/latest)
[![Coverage Status](https://coveralls.io/repos/github/ggican/im-review/badge.svg?branch=main)](https://coveralls.io/github/ggican/im-review?branch=main)
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ESLint](https://img.shields.io/badge/code_style-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org/)
[![Prettier](https://img.shields.io/badge/code_style-Prettier-ff69b4?logo=prettier&logoColor=white)](https://prettier.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Desktop work hub for engineers: **GitHub PR triage**, **AI-assisted review** (human confirms before submit), **Jira work**, **Gmail**, **Google Calendar**, and an **engineering metrics scorecard** in one focused desktop app.

Built with **Tauri 2 + React + TypeScript**. After install, paste a GitHub PAT on first launch — no OAuth app registration, no macOS Keychain prompt. Tokens stay in local app storage (never committed to git).

---

## Why IM Review?

Managing engineering work is fragmented: GitHub for pull requests, Jira for assigned work, Gmail for requests and alerts, and Calendar for meetings. Keeping all of them open turns a workday into constant context switching.

IM Review brings the daily check-in into one desktop app. It is not meant to replace GitHub, Jira, Gmail, or Google Calendar; it gives you one focused place to triage what needs attention, then opens the source service when you need to go deeper.

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
| **One work hub**            | PRs, Jira work, Gmail, and meetings in one daily triage surface                   |

### Advantages vs “just GitHub + ChatGPT”

1. **Review loop stays in one place** — list → open → draft → submit → local history.
2. **Human gate** — AI never posts without confirmation.
3. **Secrets stay local** — PAT and AI keys in local app storage (not uploaded to our servers).
4. **Metrics you can audit** — raw values + published formulas (see [docs/METRICS.md](docs/METRICS.md)).
5. **Bring your own model** — pick the AI provider you already pay for.

---

## Features (current)

### GitHub pull requests

- GitHub PAT onboarding; tokens and provider keys stay on the local machine
- A **Today** view that combines review requests, CI failures, Jira work, Gmail, and upcoming meetings
- PR queues for favorites, assigned/review-requested work, your open PRs, reviewed history, and favorite people
- Repository, branch, and GitHub-user favorites; search repositories and inspect their open PRs
- PR detail with description, changed files and diffs, CI/Jenkins checks, reviews, and conversation
- Submit **Approve**, **Comment**, or **Request changes**, including optional inline file comments
- Close, convert to draft, or reopen PRs you authored

### AI-assisted review

- Generate patch-based review drafts without cloning the repository by default
- Use Cursor, OpenAI, OpenAI Codex-compatible models, Anthropic Claude, or Google Gemini
- Edit the summary and findings, include or ignore individual findings, and refine a draft before submission
- Explicit human confirmation gate: AI never posts a review automatically

### Jira, Gmail, and Calendar

- Jira Cloud: view your work, filter by status, assignee, issue type, labels, and JQL; save filters locally or to Jira
- Jira issue detail with parent work item, status, labels, assignee, description, and a link back to Jira
- Google Calendar: connect one Google account, browse Today/Upcoming/This week/All-day events, choose a calendar, and search meetings
- Gmail: Inbox, Unread, Starred, and Sent views; label and search filters; message reading; star, mark read/unread, archive, and open in Gmail

### Productivity and insights

- ⌘K / Ctrl+K command palette for fast navigation to PRs, repositories, people, and work surfaces
- Auto-refresh, new-item badges, dock/tray indicators, and macOS notifications for new PRs or CI failures
- Menu-bar tray behavior, light/dark/system themes, review comment templates, and local review history
- In-app update notice with a user-approved download and install flow
- Engineering scorecard for Today / 7 / 14 / 30 days with Average and P50–P99 aggregation
- Speed, Throughput, Quality, and Collaboration breakdowns, CI health, trend charts, and actionable suggestions

---

## Requirements

- **macOS** (primary; Windows/Linux via Tauri possible)
- **Node.js 20+** and **pnpm**
- **Rust** toolchain ([rustup](https://rustup.rs/)) for Tauri
- **GitHub Personal Access Token** with at least `repo` + `read:user`
- Optional: API key for one AI provider (Cursor / OpenAI / Anthropic / Gemini / Codex)

---

## Install (end users)

Download the current release: **[IM Review for macOS](https://github.com/ggican/im-review/releases/latest)**

1. Open [Releases](https://github.com/ggican/im-review/releases) if you need a specific version
2. Download the latest **`.dmg`**
3. Open the DMG → drag **IM Review** to Applications
4. First launch may need **Right-click → Open** (ad-hoc/unsigned builds until Apple notarization is configured)

---

## Install & run (development)

```bash
git clone https://github.com/ggican/im-review.git
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
pnpm check             # typecheck + lint + prettier + tests
pnpm release:patch     # bump x.y.Z, commit, tag, push (triggers Release CI)
pnpm release:minor     # bump x.Y.0
pnpm release:major     # bump X.0.0
```

Dry-run a bump without writing files:

```bash
pnpm release:patch -- --dry-run
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
| **Cursor**             | Cursor Dashboard → Integrations   | Bundled Cursor SDK (needs Node.js 22.13+ on PATH)        |
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
