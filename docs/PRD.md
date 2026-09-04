# PRD — `im-review`

> **Status:** Draft v0.2 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-03
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

---

## 1. Ringkasan

`im-review` adalah **desktop app** (Tauri + React + TypeScript) yang membantu reviewer & author Pull Request mempercepat aktivitas harian di sekitar PR: melihat daftar PR yang relevan, mengelola **favorite / all repos**, membuka detail, aksi cepat (approve / request changes / open in browser), serta **AI review via Cursor** (draft findings dulu, baru post ke GitHub).

- ✅ Stack: Tauri 2, React 19, Vite 7, TailwindCSS 4, Radix UI, react-router-dom 7, sonner, lucide-react
- ✅ Tooling: pnpm, ESLint, Prettier, Husky + lint-staged
- 📝 AI: Cursor SDK (`@cursor/sdk`) + Cursor API key di OS keychain — **M8**
- 📝 Distribusi: macOS `.app` + `.dmg` (ad-hoc local / Developer ID + notarize via docs/RELEASE.md) — ✅ M6
- 📝 Windows/Linux menyusul — **TBC**

## 2. Problem statement

Reviewer PR (khususnya di tim yang punya banyak repo & banyak PR aktif) menghadapi:

1. **Konteks tersebar** — PR ada di beberapa repo / beberapa akun (kerja + personal). Web GitHub cuma nunjukin satu tab.
2. **Loop review manual** — buka PR → cek checklist tim → tulis komentar template → approve. Repetitif.
3. **Notifikasi noise** — susah bedain PR yang "nunggu gue" vs "sekadar CC".
4. **Butuh cepat** — sering cuma butuh action singkat (approve, comment, open) tanpa full IDE.
5. **Repo overload** — sulit fokus ke subset repo yang penting (favorite) vs scrolling semua org/user repos.
6. **AI review tanpa kontrol** — auto-post review berbahaya; butuh draft findings yang bisa dicek dulu.

## 3. Goals & non-goals

### Goals (v0.1 – sudah)

- G1. Tampilkan daftar PR yang **assigned/requested review** ke user, cross-repo. ✅
- G2. Lihat detail PR: judul, deskripsi, status CI, reviewers, files changed count. ✅
- G3. Aksi cepat: **open in browser**, **copy link**, **approve**, **comment template**. ✅
- G4. Auth pakai **GitHub Personal Access Token** disimpan aman di OS keychain via Tauri. ✅
- G5. Refresh otomatis + manual. ✅ (indikator "PR baru sejak terakhir buka" ✅ M5)

### Goals (v0.2 – baru)

- G6. **List semua repo** yang accessible oleh user (GitHub `/user/repos`), dengan search/filter.
- G7. **Favorite repos** (CRUD lokal) — pin repo penting; filter PR list by favorites (opsional).
- G8. **Cursor AI review** pada sebuah PR:
  1. Generate draft findings (list) di UI
  2. User review / edit / uncheck findings
  3. Baru **Post review** ke GitHub (comment / request changes) — **tidak auto-post**

### Non-goals

- ❌ Full diff viewer / inline code review di app (cukup redirect ke web / AI summary).
- ❌ Multi-provider (GitLab/Bitbucket) — GitHub dulu.
- ❌ Analytics/dashboard tim.
- ❌ CI provider integrasi custom (pakai status yang sudah ada di GitHub API).
- ❌ Auto-merge / push commit dari app.
- ❌ Cursor AI yang langsung post review tanpa konfirmasi user.

## 4. Target user & use cases

**Primary user:** software engineer yang review 3–15 PR/hari lintas beberapa repo.

Use cases:

- UC1. "Pagi hari" — buka app, lihat 5 PR yang nunggu gue, klik satu, approve, next. ✅
- UC2. "Notifikasi CI merah" — badge di app tray/dock ketika PR yang gue author CI-nya gagal. ✅ (M5)
- UC3. "Comment template" — kirim komentar "LGTM, thanks!" atau "please rebase" dalam 1 klik. ✅
- UC4. "Quick jump" — search PR by title/repo (⌘K palette). ✅ (M5)
- UC5. "Favorite repos" — star/pin `acme/api`, `acme/web`; dashboard PR bisa difilter ke favorites saja. **M7**
- UC6. "Browse all repos" — buka halaman Repos, search `payment`, favorite yang relevan. **M7**
- UC7. "AI draft review" — di drawer PR, klik **Cursor AI** → tunggu findings → uncheck yang nggak relevan → **Post as comment**. **M8**

## 5. User flows

### 5.1 MVP (sudah)

1. **Onboarding** — PAT → validate → keychain → dashboard. ✅
2. **Dashboard** — 3 tab Assigned / Review requested / My open. ✅
3. **Detail drawer** — meta + aksi approve/comment/request changes. ✅
4. **Settings** — refresh interval, theme, templates, reconnect PAT. ✅

### 5.2 Repos & favorites (M7)

1. Nav **Repos** dari dashboard.
2. Fetch `/user/repos?per_page=100&sort=updated` (paginate jika perlu).
3. Search lokal by `owner/name` + description.
4. Toggle ⭐ → simpan ke localStorage (`favoriteRepos: string[]`).
5. Di dashboard: toggle filter **"Favorites only"** — PR list di-filter `pr.repo ∈ favorites`.
6. Empty state: "No favorites yet — add some from Repos".

### 5.3 Cursor AI review (M8) — 2 tahap wajib

```
[PR Detail Drawer]
        │
        ▼
  [Cursor AI]  ──(butuh Cursor API key)──► Settings kalau belum ada
        │
        ▼
  Loading… fetch PR files/diff (GitHub) + Agent.prompt (Cursor SDK)
        │
        ▼
  ┌─────────────────────────────────────┐
  │  AI Review draft                    │
  │  ☑ Finding 1 (severity / file:line) │
  │  ☑ Finding 2 …                      │
  │  ☐ Finding 3 (user uncheck)         │
  │  Summary (editable)                 │
  │  Event: Comment | Request changes   │
  │  [Cancel]  [Post review to GitHub]  │
  └─────────────────────────────────────┘
        │
        ▼ (hanya setelah user klik Post)
  submitReview(event, body dari findings tercentang)
```

**Aturan:**

- AI **tidak pernah** memanggil GitHub review API sendiri.
- Post hanya lewat tombol user + toast sukses/gagal.
- Draft bisa di-cancel; findings hilang (tidak disimpan permanen di v0.2 — **TBC** simpan history).

## 6. Functional requirements

| ID  | Requirement                                                    | Priority | Status |
| --- | -------------------------------------------------------------- | -------- | ------ |
| F1  | Login via GitHub PAT, simpan di OS keychain                    | Must     | ✅     |
| F2  | Fetch PR list via GitHub REST API                              | Must     | ✅     |
| F3  | 3 kategori tab (Assigned / Review requested / My open)         | Must     | ✅     |
| F4  | Detail drawer dengan meta + checks                             | Must     | ✅     |
| F5  | Aksi: open in browser, copy link                               | Must     | ✅     |
| F6  | Aksi: approve, request changes, comment (via API)              | Should   | ✅     |
| F7  | Comment templates (CRUD lokal)                                 | Should   | ✅     |
| F8  | Auto refresh (default 5 menit, configurable)                   | Should   | ✅     |
| F9  | Toast notifikasi via sonner untuk hasil aksi                   | Must     | ✅     |
| F10 | Empty/error/loading state di setiap list                       | Must     | ✅     |
| F11 | Dark mode (system / light / dark)                              | Nice     | ✅     |
| F12 | ⌘K command palette                                             | Nice     | ✅     |
| F13 | Halaman Repos: list semua repo user (paginated) + search       | Must     | ✅     |
| F14 | Favorite repos (CRUD lokal, keychain/localStorage)             | Must     | ✅     |
| F15 | Filter dashboard PR by favorites                               | Should   | ✅     |
| F16 | Settings: simpan Cursor API key di OS keychain                 | Must     | ✅     |
| F17 | Tombol **Cursor AI** di PR drawer                              | Must     | ✅     |
| F18 | Generate AI review draft (structured findings list)            | Must     | ✅     |
| F19 | UI draft: checklist findings, edit summary, pilih event review | Must     | ✅     |
| F20 | Post review ke GitHub **hanya** setelah konfirmasi user        | Must     | ✅     |

## 7. Non-functional requirements

- **Perf:** initial render < 1s setelah token valid; list refresh < 2s untuk ≤ 100 PR.
- **Security:** GitHub PAT **dan** Cursor API key **tidak pernah** ditulis ke file plaintext / log; hanya di keychain.
- **AI safety:** no auto-post; user selalu lihat draft dulu.
- **Offline:** tampilkan cached list terakhir + banner "offline".
- **Bundle:** target < 15 MB installer macOS (AI SDK boleh lazy / optional dependency).
- **Aksesibilitas:** Radix + keyboard-nav penuh.

## 8. Arsitektur teknis

```
┌──────────────────────────── Tauri App ────────────────────────────┐
│                                                                    │
│  React (src/)                         Rust (src-tauri/)            │
│  ├── routes/                          ├── commands.rs              │
│  │   ├── dashboard.tsx                │   save/load/delete         │
│  │   ├── repos.tsx          (M7)      │   github_pat               │
│  │   ├── settings.tsx                 │   cursor_api_key  (M8)     │
│  │   └── onboarding.tsx               │   github_get / _request    │
│  ├── features/                        └── …                        │
│  │   ├── pr/                                                       │
│  │   ├── repos/             (M7)                                   │
│  │   └── ai-review/         (M8)                                   │
│  │       ├── cursor.ts   (@cursor/sdk Agent.prompt)                │
│  │       ├── AiReviewPanel.tsx                                     │
│  │       └── types.ts                                              │
│  └── lib/settings.ts (favorites + app settings)                    │
└────────────────────────────────────────────────────────────────────┘
```

**Keputusan:**

- GitHub calls tetap via Rust `github_get` / `github_request` (token tidak di JS setelah tersimpan). ✅
- Cursor API key: command Rust terpisah (`save_cursor_key` / `has_cursor_key` / `delete_cursor_key` / `get_cursor_key` untuk invoke SDK). **M8**
- Cursor runtime: **cloud** preferred (tidak wajib clone repo lokal); fallback **local** kalau `cwd` repo tersedia — **TBC Q11**.
- AI output: minta JSON findings di prompt; parse + fallback ke plain text summary kalau parse gagal.
- Favorites: localStorage (sama pola settings/templates) — cukup untuk v0.2.

## 9. Data model (client-side)

```ts
type PullRequest = {
  id: number;
  number: number;
  repo: string; // "owner/name"
  title: string;
  url: string;
  state: "open" | "closed" | "merged";
  author: { login: string; avatarUrl: string };
  isDraft: boolean;
  updatedAt: string;
  createdAt: string;
};

type Repo = {
  id: number;
  fullName: string; // "owner/name"
  description: string | null;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
};

type CommentTemplate = { id: string; name: string; body: string };

type AppSettings = {
  refreshIntervalMin: number;
  theme: "system" | "light" | "dark";
  favoritesOnly: boolean; // filter PR dashboard
};

// favorites: string[] of fullName — stored separately

type AiFinding = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  path?: string;
  line?: number;
  included: boolean; // checklist di UI
};

type AiReviewDraft = {
  prKey: string; // "owner/name#123"
  summary: string;
  findings: AiFinding[];
  suggestedEvent: "COMMENT" | "REQUEST_CHANGES" | "APPROVE";
  model?: string;
  createdAt: string;
};
```

## 10. Milestones

| Milestone | Scope                                                    | Target  |
| --------- | -------------------------------------------------------- | ------- |
| M0        | Scaffold Tauri+React+Tailwind+Radix                      | ✅ Done |
| M1        | Onboarding + simpan PAT di keychain                      | ✅ Done |
| M2        | Dashboard list (F2–F5, F9, F10)                          | ✅ Done |
| M3        | Detail drawer + aksi API (F6)                            | ✅ Done |
| M4        | Templates + settings (F7, F8, F11)                       | ✅ Done |
| **M7**    | **Repos list + favorites + filter PR (F13–F15)**         | ✅ Done |
| **M8**    | **Cursor AI draft → confirm → post (F16–F20)**           | ✅ Done |
| M5        | Polish: ⌘K, notifikasi tray/dock badge, "new since last" | ✅ Done |
| M6        | Package & sign macOS build (ad-hoc + RELEASE docs)       | ✅ Done |

> Urutan implementasi disepakati: **M7 → M8**, lalu polish M5/M6.

## 11. Risks

- **GitHub rate limit** untuk PAT (5k req/hour) — mitigasi: caching + ETag; repos list di-cache.
- **Keychain UX** beda per-OS — fokus macOS.
- **Cursor SDK beta** — API/model id bisa berubah; pin versi + abstraksi di `features/ai-review/`.
- **AI cost / latency** — tampilkan progress; jangan block UI; cancelable.
- **Hallucinated findings** — UI checklist + human confirm sebelum post.
- **Diff size** — PR besar bisa melebihi context; potong ke file berubah / patch summary (TBC Q12).

## 12. Open questions

| #   | Pertanyaan                                                           | Jawaban                     |
| --- | -------------------------------------------------------------------- | --------------------------- |
| Q1  | Target OS pertama: macOS only, atau macOS + Windows sekaligus?       | macOS (default)             |
| Q2  | GitHub-only atau perlu GitLab/Bitbucket?                             | GitHub only                 |
| Q3  | Auth: PAT saja, atau nanti OAuth Device Flow?                        | PAT                         |
| Q4  | API call di frontend langsung, atau di-proxy lewat Rust?             | Proxy Rust ✅               |
| Q5  | Multi-akun GitHub di v0.1?                                           | Single                      |
| Q6  | Notifikasi native (tray/dock badge)?                                 | M5 / v0.2 later             |
| Q7  | Comment templates — global atau per-repo?                            | Global                      |
| Q8  | Integrasi Jira?                                                      | Tidak                       |
| Q9  | Nama app final?                                                      | **IM Review** (`im-review`) |
| Q10 | Design/mockup?                                                       | Improv                      |
| Q11 | Cursor AI: **cloud** agent vs **local** cwd?                         | TBC — default cloud         |
| Q12 | PR besar: kirim full diff, file list only, atau top-N changed files? | TBC — top-N + patch         |
| Q13 | Default post event AI: Comment vs Request changes?                   | TBC — Comment               |
| Q14 | Simpan history AI drafts antar session?                              | TBC — tidak di M8           |
| Q15 | Favorite sync antar mesin?                                           | TBC — lokal saja            |

> **Default sampai override:** Q11 cloud · Q12 top-N changed files + patch ringkas · Q13 Comment · Q14 no history · Q15 lokal.

## 13. Appendix — struktur folder (target setelah M7–M8)

```
src/
├── main.tsx
├── router.tsx
├── routes/
│   ├── onboarding.tsx
│   ├── dashboard.tsx
│   ├── repos.tsx              # M7
│   └── settings.tsx           # + Cursor API key (M8)
├── features/
│   ├── pr/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   ├── PRList.tsx
│   │   ├── PRRow.tsx
│   │   └── PRDetailDrawer.tsx # + Cursor AI button (M8)
│   ├── repos/                 # M7
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   ├── RepoList.tsx
│   │   └── RepoRow.tsx
│   └── ai-review/             # M8
│       ├── cursor.ts
│       ├── prompt.ts
│       ├── types.ts
│       └── AiReviewPanel.tsx
├── components/ui/
├── lib/
│   ├── api.ts
│   ├── cn.ts
│   ├── settings.ts            # + favorites
│   ├── time.ts
│   └── use-settings.ts
└── styles/globals.css

src-tauri/src/
├── main.rs
├── lib.rs
└── commands.rs                # + cursor keychain commands (M8)
```

## 14. Acceptance criteria (M7 / M8)

### M7

- [x] Route `/repos` menampilkan repo user dengan search
- [x] Toggle favorite persist setelah reload
- [x] Dashboard punya filter Favorites only
- [x] Loading / empty / error states

### M8

- [x] Cursor API key bisa disimpan / dihapus di Settings (keychain)
- [x] Tombol Cursor AI di drawer; disabled + CTA ke Settings jika belum ada key
- [x] Setelah generate: panel draft findings (checklist) terlihat **sebelum** ada call GitHub review
- [x] Post hanya mengirim findings yang `included === true`
- [x] Cancel / tutup panel tidak mem-post apa pun
- [x] Toast sukses/gagal pada generate & post

> Implementasi: Cloud Agents REST API (`api.cursor.com/v1`) dari Rust — **patch-only** (diff diambil via GitHub API, tanpa clone repo bila memungkinkan). Full-screen `/review/:owner/:repo/:number` dengan progress steps. Post ke GitHub **hanya** setelah checkbox konfirmasi user.
