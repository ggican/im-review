# Product

<!-- impeccable:product-schema 1 -->

> **Inference note (init, 2026-09-03):** User asked to run full setup without answering the interview round. Facts below are inferred from the running codebase and prior product conversation; labeled where not user-confirmed. Correct anything that is wrong.

## Platform

web

## Users

Primary user: a frontend engineer / PR reviewer (inferred: tiket frontend org) who reviews many GitHub pull requests across a fixed set of favorite repos, often during focused review sessions on a desktop machine.

Job: triage assigned / review-requested PRs quickly, draft an AI-assisted review, confirm it, and submit inline GitHub review comments without cloning each repo.

## Product Purpose

IM Review is a desktop app (Tauri + React) that lists GitHub PRs, filters to favorite repos/branches, generates AI code-review drafts via local Cursor SDK from GitHub patches (no clone), lets the human edit/confirm, and submits inline file/line comments to GitHub. Success = faster, trustworthy reviews that land as real GitHub review comments and stay visible in the app as reviewed history.

## Positioning

Patch-only, chat-like review path: GitHub diffs + local Cursor Agent — no Cloud Agents requirement for the review loop, no full repo clone for the default path. Human always confirms before submit. Favorites + local saved-review history keep reviewed PRs from disappearing after GitHub drops the review request.

## Operating Context

- Desktop Tauri shell; Vite React UI; GitHub REST via personal access token stored in OS keychain.
- Local Cursor SDK (`@cursor/sdk` / `scripts/cursor-local-prompt.mjs`) for AI drafts.
- LocalStorage for settings, favorite repos/branches, comment templates, saved review history.
- Default favorite repos are tiket frontend repos; `favoritesOnly` defaults on.
- Main surfaces: Onboarding (token), Dashboard (PR lists), Repos, Settings, PR detail / AI review (`/review/:owner/:repo/:number`) with tabs for detail, files, reviews, AI.

## Capabilities and Constraints

**Confirmed capabilities**
- Auth with GitHub PAT; list assigned / review-requested / authored PRs.
- Favorite repos (seeded defaults) and favorite branches; filter dashboard by favorites.
- AI draft review from patches; parse into structured comments; submit as GitHub PR review with inline `comments[]` snapped to commentable hunk lines.
- Keep locally submitted reviews visible with reviewed status; show current GitHub reviews on the PR.
- Theme: system / light / dark; auto-refresh interval; comment templates.

**Constraints**
- Requires valid GitHub token with PR read/write as needed for submit.
- AI path depends on local Cursor/Node availability for the SDK bridge.
- Tokens must never be printed or committed; keychain + env only.
- Desktop-first Operate UI; not a marketing site.

**Open / undecided**
- Product brand confirmed: **IM Review** (IM suite).
- Accessibility standard target (WCAG level) — not set.
- Whether Pro Max recommended dark “devtool” palette should replace the incumbent Inter/neutral UI — not decided (see `design-system/pr-helper/MASTER.md` as proposal only).

## Brand Commitments

- Product name in use: **IM Review** / package `im-review`.
- No separate marketing brand system or logo pack committed yet.
- Icons: Lucide. UI primitives: Radix + Tailwind utility classes.

## Evidence on Hand

- Working app source under `src/` (routes, PR list, AI review, settings, repos).
- Default favorite list in `src/lib/settings.ts` (`DEFAULT_FAVORITES`).
- No marketing site, testimonials, or press assets — do not fabricate.

## Product Principles

1. **Human confirms AI** — drafts accelerate review; submit is always intentional.
2. **Stay in the review loop** — favorites and local history keep the queue useful after GitHub state changes.
3. **No clone by default** — patch-based path stays fast for multi-repo reviewers.
4. **Operate, don’t decorate** — density and scanability beat marketing chrome on app surfaces.
5. **Secrets stay local** — tokens in keychain; never in logs, UI dumps, or git.

## Accessibility & Inclusion

No product-specific WCAG target confirmed. Existing tooling includes `eslint-plugin-jsx-a11y`. Prefer visible focus rings and contrast that already exist in the incumbent UI until a standard is chosen.
