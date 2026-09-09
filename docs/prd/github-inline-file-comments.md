# PRD — Inline file comments (GitHub-style review)

> **Status:** Draft v0.2 · **Owner:** Ikhsan Mahendri · **Updated:** 2026-09-09  
> **Related:** [docs/PRD.md](../PRD.md) · [PRD-github-review-comments.md](../PRD-github-review-comments.md) · API: `submitReview` + `comments[]`  
> Legenda: ✅ ada · 📝 direncanakan · **TBC** = to be confirmed

---

## 1. Jawaban singkat: apakah bisa?

**Ya.** Model produk IM Review = **tiga jalur review**, semua lewat GitHub Create Review API:

| Mode                      | Arti                                                                                      | Status          |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------- |
| **Instant**               | Approve / Comment / Request changes cepat (body ± template), tanpa line notes             | ✅ sudah ada    |
| **AI review**             | Generate findings → edit/checklist → post (boleh Comment / Request changes / **Approve**) | ✅ sudah ada    |
| **Manual (GitHub-style)** | Cek diff → klik baris → draft komentar → submit sekali                                    | 📝 M9 (PRD ini) |

### Approve + tetap kasih review — **boleh & didukung**

GitHub mengizinkan `event: "APPROVE"` **bersama** `comments[]` (inline) dan/atau `body` summary dalam **satu** submit.

Juga boleh **approve belakangan** setelah sebelumnya sudah `COMMENT` / `REQUEST_CHANGES` (submit review baru `APPROVE`). State efektif mengikuti aturan branch protection / latest review GitHub.

**Keputusan produk (2026-09-09):**

1. ✅ Instant approve tetap ada.
2. ✅ AI review tetap ada (confirm before post).
3. ✅ Manual line-comment seperti github.com (M9).
4. ✅ **Approve dengan komentar** diizinkan (instant body, AI findings, atau pending manual — semua boleh event Approve).
5. ✅ **Approve setelah sudah review** diizinkan (tombol Approve tetap tersedia; tidak dikunci hanya karena sudah COMMENT).

---

## 2. Problem

Reviewer sering ingin:

- Komentar di **baris konkret** (bukan cuma summary PR).
- Campur **komentar manusia** + **finding AI** sebelum submit.
- **Approve sambil** meninggalkan catatan di kode (“LGTM, satu nit di baris X”).
- Atau dulu comment/request changes, lalu **approve** setelah author fix — tanpa harus ke browser.
- Tetap di IM Review tanpa bolak-balik ke browser hanya untuk satu line note.

Saat ini:

| Capability                                            | Status                            |
| ----------------------------------------------------- | --------------------------------- |
| Instant Approve / Comment / Request changes (body)    | ✅                                |
| Lihat changed files + patch diff                      | ✅                                |
| AI → inline comments on submit                        | ✅                                |
| AI / quick path boleh pilih Approve                   | ✅ (UI sudah punya event Approve) |
| Klik baris → draft inline comment                     | ❌                                |
| Pending review (multi-comment draft)                  | ❌                                |
| Sticky “Finish review” dengan Approve + pending lines | ❌                                |
| Reply / resolve thread di app                         | ❌ (lihat PRD conversation)       |

PRD produk lama (`docs/PRD.md`) sempat menandai full inline review sebagai **non-goal**. Fitur ini **mengubah** keputusan itu untuk v0.2+/v0.3.

---

## 3. Goals & non-goals

### Goals (MVP — M9)

- G1. Di tab **Files**, user bisa menambah **draft inline comment** pada baris commentable **RIGHT** (added + context). LEFT/deleted = M9c.
- G2. Draft comments tampil di UI (per file / panel “Pending comments”).
- G3. User bisa edit / hapus draft sebelum submit.
- G4. **Submit review** mengirim overall body (opsional) + semua draft inline via `POST .../pulls/{n}/reviews` (sama seperti AI path).
- G5. Human selalu konfirmasi submit (tidak auto-post).
- G6. Draft AI findings bisa digabung ke pending comments yang sama (satu submit).
- G7. **Tiga mode tetap hidup berdampingan:** Instant · AI · Manual (tidak saling menggantikan).
- G8. Event **Approve** tersedia di Finish-review bar **meski** ada pending inline comments.
- G9. Setelah user pernah submit COMMENT/REQUEST_CHANGES (dari app atau GitHub), **Quick approve / Approve** tetap bisa dikirim sebagai review baru.

### Non-goals (MVP)

- ❌ Full GitHub “Conversation” thread UI (reply nested, emoji reactions, suggested changes apply) — terpisah di [PRD-github-review-comments.md](../PRD-github-review-comments.md).
- ❌ Edit / delete komentar yang sudah ter-submit di GitHub (slice conversation).
- ❌ Multi-commit review picker yang kompleks (pakai `head` SHA PR saja dulu).
- ❌ Comment di file di luar diff / di luar hunk (GitHub juga membatasi ke line di diff).
- ❌ Real-time collab / live cursors.
- ❌ Memaksa user pilih hanya satu mode (Instant **atau** AI **atau** Manual) per PR.

### Later (nice)

- Suggested changes (` ```suggestion ` blocks).
- Start pending review via GitHub “pending review” API — **tidak di M9**; pakai draft lokal + one-shot submit.
- Show existing inline threads next to lines (read-only from `pulls/{n}/comments`).
- Keyboard: `n` / `p` next file; `c` comment on focused line.

---

## 4. Tiga mode review (produk)

```
                    ┌─────────────────────┐
                    │   PR review page    │
                    └─────────┬───────────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   [Instant]            [AI review]         [Manual / Files]
   Quick Approve        Generate draft      + on line → pending
   / Comment / RC       checklist+refine    Finish review bar
          │                   │                   │
          └───────────────────┴───────────────────┘
                              ▼
              submitReview(event, body?, { commitId, comments? })
                              ▼
                           GitHub
```

| Mode    | Kapan dipakai                   | Event yang didukung                                   |
| ------- | ------------------------------- | ----------------------------------------------------- |
| Instant | PR jelas bagus / cukup template | Approve · Comment · Request changes                   |
| AI      | Butuh bantuan scan diff         | Approve · Comment · Request changes (setelah confirm) |
| Manual  | Ingin catatan di baris spesifik | Approve · Comment · Request changes (+ pending lines) |

**Campur mode (diizinkan):**

- Manual pending + AI findings tercentang → **satu** Submit.
- Manual/AI pending + pilih **Approve** → Approve **dengan** inline comments.
- Sudah pernah Comment di GitHub → tetap bisa Instant **Approve** lagi.

**Draft PR:** Approve tetap diblokir GitHub (sudah di app) — berlaku semua mode.

---

## 5. User experience (target = github.com Files)

### 5.1 Happy path (manual)

```
PR → Files tab
  → expand file diff
  → hover line gutter → [+]
  → composer: textarea + Cancel / Add comment
  → comment masuk “Pending (N)”
  → (opsional) Run AI review → findings checked juga masuk pending
  → Review bar: event = Comment | Approve | Request changes
  → [Submit review]
  → toast sukses → clear pending → refresh Current reviews
```

### 5.2 Approve + review comments (satu submit)

```
Pending (2) + summary “LGTM, nits below”
  → event = Approve
  → Submit
  → GitHub: state APPROVED + 2 inline comments
```

### 5.3 Approve setelah sudah kasih review

```
Sebelumnya: COMMENT atau REQUEST_CHANGES (app / GitHub)
  → author fix / reviewer puas
  → Instant Approve (atau Finish review Approve tanpa pending)
  → GitHub: review baru APPROVED (latest state)
```

Local history boleh menyimpan kedua jejak; badge dashboard = **latest** submit dari app saja.

### 5.4 Visual (MVP)

```
┌ Files ─────────────────────────────────────────────┐
│ src/foo.ts                              +12 −3      │
│  10  │  const x = 1                                 │
│  11+ │  const y = 2     ← [+] on hover              │
│      │  ┌─ Draft comment ─────────────────────┐     │
│      │  │ textarea…                            │     │
│      │  │ [Cancel]  [Add to pending]           │     │
│      │  └──────────────────────────────────────┘     │
│ … Conversation (issue comments) …                   │
└─────────────────────────────────────────────────────┘

┌ Pending review (2) ── [Approve ▾] [Submit review] ──┐
│ • foo.ts:11  “Rename for clarity”                    │
│ • bar.ts:40  “Missing null check”                    │
│ Hint: Approve + comments = OK (sama seperti GitHub)  │
└──────────────────────────────────────────────────────┘
```

### 5.5 Rules (parity with GitHub)

- Hanya line yang **ada di unified diff** dan valid untuk API (`line` + `side`).
- Baris `+` / context → `side: "RIGHT"` + new-file line number.
- Baris `-` → `side: "LEFT"` + old-file line (**phase 2** jika MVP hanya RIGHT).
- Hunk header / meta → tidak commentable.
- Empty body → tidak boleh Add; Submit COMMENT/REQUEST_CHANGES butuh body **atau** ≥1 pending comment.
- Submit **APPROVE** boleh dengan body kosong **dan** boleh dengan pending comments (G8).
- Draft PR: disable Approve di semua mode.

---

## 6. Functional requirements

| ID    | Requirement                                                                | Pri    | Status |
| ----- | -------------------------------------------------------------------------- | ------ | ------ |
| IFC1  | Line gutter affordance (+) on commentable diff lines                       | Must   | ✅     |
| IFC2  | Inline composer anchored to line                                           | Must   | ✅     |
| IFC3  | Pending comments store (path, line, side, body, source: manual\|ai)        | Must   | ✅     |
| IFC4  | Edit / remove pending comment                                              | Must   | ✅     |
| IFC5  | Submit via existing `submitReview(..., { commitId, comments })`            | Must   | ✅     |
| IFC6  | Pass `commit_id` = PR head SHA (required by GitHub for inline comments)    | Must   | ✅     |
| IFC7  | Merge selected AI findings into same pending bag before submit             | Should | ✅     |
| IFC8  | Disable Submit when COMMENT/REQUEST_CHANGES and no body + no comments      | Must   | ✅ API |
| IFC9  | After success: clear pending, toast, refresh reviews tab                   | Must   | ✅     |
| IFC10 | Show existing GitHub inline count (read) near files — deep thread UI later | Nice   | 📝     |
| IFC11 | Unit tests: parse commentable lines, pending store, payload builder        | Must   | ✅     |
| IFC12 | Finish-review bar includes **Approve** even when pending.length > 0        | Must   | ✅     |
| IFC13 | Instant / AI Approve tetap usable after prior COMMENT/REQUEST_CHANGES      | Must   | ✅     |
| IFC14 | Copy/helper text: “You can approve and still leave line comments”          | Should | ✅     |

---

## 7. Technical approach

### 7.1 GitHub API (sudah ada di codebase)

```http
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
{
  "commit_id": "<head sha>",
  "body": "optional summary",
  "event": "COMMENT" | "APPROVE" | "REQUEST_CHANGES",
  "comments": [
    { "path": "src/a.ts", "line": 11, "side": "RIGHT", "body": "..." }
  ]
}
```

Referensi implementasi: `src/features/pr/api.ts` → `submitReview`,  
`src/features/ai-review/generate.ts` → `buildGithubReviewPayload` + `snapToCommentableLine`.

`APPROVE` + `comments[]` non-empty = valid di GitHub (ini yang menjawab “approve tapi tetap kasih review”).

### 7.2 UI building blocks to extend

- `ChangedFilesPanel` — sudah parse patch → `oldLine` / `newLine` / kind. Tambah line actions + composer.
- Review page (`src/routes/ai-review.tsx`) — pending review chrome (sticky bar) + keep Quick approve.
- Reuse AI payload helpers for line snapping so manual + AI share one validation path.

### 7.3 State

```ts
type PendingInlineComment = {
  id: string;
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  body: string;
  source: "manual" | "ai";
};
```

Scope: **per PR session** (in-memory). Tidak persist localStorage di M9a (keputusan: session only).

### 7.4 Risks

| Risk                                   | Mitigation                                      |
| -------------------------------------- | ----------------------------------------------- |
| Line not in diff → 422                 | Reuse `snapToCommentableLine` / disable invalid |
| Stale head SHA                         | Refresh detail before submit; show SHA short    |
| Large files / long patches             | Virtualize later; MVP expand-one-file           |
| Duplicate AI + manual lines            | Allow both; user deletes before submit          |
| User kira Approve “menghapus” komentar | Copy IFC14; comments tetap di GitHub            |

---

## 8. Acceptance criteria (MVP)

1. Dari Files tab, user bisa menambah ≥1 inline draft pada baris `+` / context.
2. Pending list menampilkan path:line + cuplikan body; bisa hapus.
3. Submit **Comment** dengan 1+ inline comments muncul di GitHub.
4. Submit **Approve** dengan 1+ inline comments → GitHub APPROVED **dan** inline comments terlihat.
5. Tanpa pending + tanpa body, Submit Comment / Request changes disabled atau error jelas; Approve tanpa pending tetap boleh (instant).
6. Setelah submit COMMENT dari app, Quick approve masih bisa dijalankan (review baru APPROVE).
7. AI findings yang dicentang bisa ikut dalam submit yang sama (termasuk event Approve).
8. Unit tests baru hijau; `pnpm check` lulus.

---

## 9. Milestone suggestion

| Phase | Scope                                                                  | Effort (rough) |
| ----- | ---------------------------------------------------------------------- | -------------- |
| M9a   | RIGHT-side line comment + pending + submit (termasuk Approve+comments) | ✅ Done        |
| M9b   | Merge AI findings into pending UI                                      | S              |
| M9c   | LEFT-side (deleted lines)                                              | S              |
| M10   | Show existing threads read-only on lines                               | M              |
| M11   | Suggested changes + pending review API                                 | M–L            |

---

## 10. Open questions → keputusan (2026-09-09)

| #   | Pertanyaan                               | Keputusan                                                     |
| --- | ---------------------------------------- | ------------------------------------------------------------- |
| 1   | RIGHT saja vs LEFT+RIGHT dari awal?      | ✅ **RIGHT dulu** (M9a); LEFT di M9c                          |
| 2   | Pending persist?                         | ✅ **Session only** (hilang saat tutup/navigasi jauh dari PR) |
| 3   | Approve + inline comments?               | ✅ **Ya** (sudah dikunci sebelumnya)                          |
| 4   | Pending di server GitHub vs draft lokal? | ✅ **Draft lokal** + one-shot `submitReview`                  |
| 5   | Badge setelah Approve-after-COMMENT?     | ✅ **Latest saja** (submit terakhir dari app)                 |

## 11. Keputusan produk (terkunci 2026-09-09)

- [x] GitHub-style line comments di Files tab = M9
- [x] Tiga mode: Instant · AI · Manual
- [x] Approve + line/body review diizinkan
- [x] Approve setelah sudah review diizinkan
- [x] RIGHT-only → session draft → one-shot submit → badge latest
- [x] Siap implement **M9a** (tanpa menunggu M10/M11)
