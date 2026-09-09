# PRD — GitHub Review & Comment Loop (v0.3)

> **Status:** Draft v0.3 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-09  
> **Parent:** [docs/PRD.md](./PRD.md) (IM Review product baseline)  
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

---

## 1. Ringkasan

PRD ini mendefinisikan **slice berikutnya** untuk loop komentar & review di IM Review — hanya fitur yang **bisa dilakukan lewat GitHub REST / GraphQL** yang sudah (atau wajar) diakses lewat proxy Rust + PAT yang sama.

Fokus slice ini: **ikut percakapan** setelah/ besides submit review — issue comment, reply inline, edit/delete own, dismiss — plus rate-limit UX.

**Model review utama (tiga mode)** dikunci di [prd/github-inline-file-comments.md](./prd/github-inline-file-comments.md):

1. **Instant** — Approve / Comment / Request changes cepat ✅
2. **AI review** — draft → confirm → post ✅
3. **Manual** — klik baris di Files → pending → submit 📝

Approve **boleh** bersama komentar, dan **boleh** setelah sebelumnya sudah review.

---

## 2. Baseline (sudah ada — jangan diulang sebagai “baru”)

| Capability                                              | Bukti di kode                                       | Status                   |
| ------------------------------------------------------- | --------------------------------------------------- | ------------------------ |
| Submit review `APPROVE` / `COMMENT` / `REQUEST_CHANGES` | `submitReview` → `POST .../pulls/{n}/reviews`       | ✅                       |
| Inline comments saat post AI review                     | `buildGithubReviewPayload` + `comments[]`           | ✅                       |
| Quick review dari drawer (body saja, tanpa inline)      | `PRDetailDrawer`                                    | ✅                       |
| Comment templates (CRUD lokal)                          | Settings + drawer/review page                       | ✅                       |
| Baca reviews + inline comments                          | `fetchPrReviews` + `CurrentReviewsPanel`            | ✅                       |
| Issue comment API helper                                | `postIssueComment` → `POST .../issues/{n}/comments` | ✅ API · 📝 **UI belum** |
| Saved review history lokal                              | `saveReviewLocally` / Settings History              | ✅                       |
| Author: close / reopen / draft / ready                  | `api.ts` GraphQL + REST                             | ✅                       |
| AI draft → refine → confirm → post                      | `/review/...` + Cursor SDK                          | ✅                       |

---

## 3. Problem statement

Hari ini loop review **putus setelah submit**:

1. Author/reviewer balas inline di GitHub — app hanya **read-only** di tab Current reviews.
2. Komentar tingkat PR (bukan review event) sering dipakai untuk “rebase please” / status — API sudah ada, **tombol belum**.
3. Salah ketik / temuan AI yang sudah kepost tidak bisa **edit/delete** dari app.
4. Reviewer kadang perlu **dismiss** review lama setelah re-review — belum ada di UI.
5. Burst refresh/list (banyak repo) sudah pernah kena **secondary rate limit 403** — fitur comment baru harus hemat request.

---

## 4. Goals & non-goals

### Goals (v0.3)

- G1. **Issue-level comment** dari UI (pakai `postIssueComment` yang sudah ada).
- G2. **Reply** ke inline review comment (thread GitHub).
- G3. **Edit / delete** komentar milik user yang login (issue + pull review comment).
- G4. Tampilkan **issue comments** di tab **Files** (section Conversation di bawah patch viewer).
- G5. **Dismiss** review (milik sendiri atau sesuai permission GitHub) dengan alasan.
- G6. Throttle / cache sadar rate-limit untuk endpoint comment/review (mitigasi secondary limit).

### Non-goals

- ❌ Menggantikan / menduplikasi **manual line-comment MVP** — itu milik [prd/github-inline-file-comments.md](./prd/github-inline-file-comments.md) (M9), bukan slice conversation ini.
- ❌ Resolve/unresolve review thread via GraphQL di v0.3 pertama — **TBC** (M10+ jika dibutuhkan).
- ❌ Multi-akun GitHub.
- ❌ Bot auto-reply / auto-resolve.
- ❌ Edit review summary orang lain; edit review event yang sudah submitted (GitHub membatasi — kebanyakan immutable kecuali dismiss / komentar terpisah).
- ❌ GitLab / Bitbucket.
- ❌ Melarang Approve setelah COMMENT / Approve+inline (itu **diizinkan** — lihat PRD inline).

---

## 5. Inventory GitHub API (yang kita pakai)

Semua lewat `api.githubGet` / `api.githubRequest` (Rust proxy). Path relatif ke `https://api.github.com`.

### Sudah dipakai ✅

| Aksi                              | Method   | Path                                 |
| --------------------------------- | -------- | ------------------------------------ |
| List/submit reviews               | GET/POST | `/repos/{o}/{r}/pulls/{n}/reviews`   |
| List review comments              | GET      | `/repos/{o}/{r}/pulls/{n}/comments`  |
| Create review (+ optional inline) | POST     | `/repos/{o}/{r}/pulls/{n}/reviews`   |
| Issue comment (helper only)       | POST     | `/repos/{o}/{r}/issues/{n}/comments` |
| PR metadata / files / CI          | GET      | pulls, files, status, check-runs     |

### Ditargetkan v0.3 📝

| ID  | Aksi produk                                      | Method | Path / catatan                                                                                                         |
| --- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| A1  | List issue comments                              | GET    | `/repos/{o}/{r}/issues/{n}/comments?per_page=100`                                                                      |
| A2  | Post issue comment                               | POST   | `/repos/{o}/{r}/issues/{n}/comments` — **wrapper sudah ada**                                                           |
| A3  | Edit issue comment (own)                         | PATCH  | `/repos/{o}/{r}/issues/comments/{id}`                                                                                  |
| A4  | Delete issue comment (own)                       | DELETE | `/repos/{o}/{r}/issues/comments/{id}`                                                                                  |
| A5  | Reply ke review comment                          | POST   | `/repos/{o}/{r}/pulls/{n}/comments` body `{ body, in_reply_to }` **atau** `POST .../pulls/comments/{id}/replies`       |
| A6  | Edit review comment (own)                        | PATCH  | `/repos/{o}/{r}/pulls/comments/{id}`                                                                                   |
| A7  | Delete review comment (own)                      | DELETE | `/repos/{o}/{r}/pulls/comments/{id}`                                                                                   |
| A8  | Dismiss review                                   | PUT    | `/repos/{o}/{r}/pulls/{n}/reviews/{review_id}/dismissals` body `{ message, event: "DISMISS" }`                         |
| A9  | (Opsional) Single inline tanpa full review event | POST   | `/repos/{o}/{r}/pulls/{n}/comments` + `commit_id`, `path`, `line` — **TBC** apakah perlu di UI terpisah dari AI submit |

### Cadangan M10+ (API ada, sengaja ditunda) **TBC**

| Aksi                                        | API                                                     | Alasan tunda                            |
| ------------------------------------------- | ------------------------------------------------------- | --------------------------------------- |
| Resolve / unresolve thread                  | GraphQL `resolveReviewThread` / `unresolveReviewThread` | Perlu thread node id; UI lebih kompleks |
| Request / remove reviewers                  | REST `requested_reviewers`                              | Bukan loop comment                      |
| Reactions pada comment                      | Reactions API                                           | Nice-to-have noise                      |
| Pending review (multi-step draft di GitHub) | Create review tanpa `event` lalu submit                 | Duplikasi draft lokal AI                |

---

## 6. User flows

### 6.1 Issue comment (G1, A1–A2)

```
[PR review page · tab Files · section Conversation]
        │
        ▼
  Compose box (+ optional template chip)
        │
        ▼ user kirim
  postIssueComment(pr, body)
        │
        ▼
  Toast sukses · prepend ke list issue comments · jangan full-page refetch berlebih
```

### 6.2 Reply inline (G2, A5)

```
[Current reviews · inline comment row]
        │
        ▼ [Reply]
  Textarea singkat
        │
        ▼
  POST comment dengan in_reply_to = parent comment id
        │
        ▼
  Refresh thread lokal (atau append reply) · toast
```

### 6.3 Edit / delete own (G3, A3–A4, A6–A7)

- Tombol Edit/Delete **hanya** jika `comment.user.login === authenticated login`.
- Delete: confirm dialog singkat.
- Setelah sukses: update list lokal; toast.

### 6.4 Dismiss review (G5, A8)

- Pada kartu review (milik user atau jika API mengizinkan): **Dismiss…**
- Wajib isi `message` (GitHub mensyaratkan).
- Setelah sukses: state → `DISMISSED`; refresh snapshot reviews.

### 6.5 Rate-limit aware refresh (G6)

- Jangan parallel-fetch reviews + issue comments + CI + files tanpa debounce saat tab switch cepat.
- Hormati `Retry-After` / pesan secondary rate limit: toast “GitHub membatasi sebentar — coba lagi dalam X menit”, disable tombol submit sementara.
- Prefer append/patch lokal setelah write daripada refetch 4 endpoint sekaligus.

---

## 7. Functional requirements

| ID  | Requirement                                                                        | Priority | API        | Status      |
| --- | ---------------------------------------------------------------------------------- | -------- | ---------- | ----------- |
| F21 | UI compose + kirim **issue comment** di section Conversation (tab **Files**)       | Must     | A2         | 📝          |
| F22 | List **issue comments** chronologis di tab Files (avatar, body, time, link GitHub) | Must     | A1         | 📝          |
| F23 | Template chips mengisi compose issue comment (reuse templates)                     | Should   | —          | 📝          |
| F24 | **Reply** pada inline review comment                                               | Must     | A5         | 📝          |
| F25 | Tampilkan replies nested / flat-with-parent di Current reviews                     | Should   | A1/A5 data | 📝          |
| F26 | Edit own issue comment                                                             | Should   | A3         | 📝          |
| F27 | Delete own issue comment (confirm)                                                 | Should   | A4         | 📝          |
| F28 | Edit own pull review comment                                                       | Should   | A6         | 📝          |
| F29 | Delete own pull review comment (confirm)                                           | Should   | A7         | 📝          |
| F30 | Dismiss review + message wajib                                                     | Should   | A8         | 📝          |
| F31 | Setelah write: update UI tanpa refetch berlebih; toast error jelas untuk 403/422   | Must     | —          | 📝          |
| F32 | Secondary rate limit: deteksi message, backoff UI, jangan spam retry               | Must     | —          | 📝          |
| F33 | Single-line “Add comment on file” tanpa AI                                         | Could    | A9         | **TBC**     |
| F34 | Resolve conversation thread                                                        | Could    | GraphQL    | **TBC** M10 |

---

## 8. UX surfaces

### Halaman `/review/:owner/:repo/:number`

Tab (keputusan v0.3):

| Tab       | Isi                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------- |
| Detail    | meta, author actions (tetap)                                                                              |
| **Files** | patch viewer (read-only) **+** section Conversation: list issue comments + compose (F21–F23) ✅ keputusan |
| CI        | checks (tetap)                                                                                            |
| Reviews   | Current reviews + reply/edit/delete/dismiss (F24–F30)                                                     |
| AI        | draft flow (tetap)                                                                                        |

**Layout tab Files (atas → bawah):**

1. Changed files / patch viewer (existing)
2. Divider + heading **Conversation**
3. List issue comments (chronologis)
4. Compose box (+ template chips)

Tidak ada tab Conversation terpisah.

### Drawer `PRDetailDrawer`

- 📝 Opsional v0.3.1: satu tombol “Comment on PR” → `postIssueComment` (tanpa buka full page).
- Tidak wajib reply inline di drawer (ruang sempit).

### Settings

- Tidak perlu setting baru. Compose issue comment = plain textarea (tanpa markdown preview di M9).

---

## 9. Data model (client)

```ts
/** Issue / PR conversation comment (REST issues comments). */
type IssueComment = {
  id: number;
  body: string;
  user: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  /** true jika user.login === auth login — untuk edit/delete */
  isOwn: boolean;
};

type PrReviewComment = {
  id: number;
  path: string;
  line: number | null;
  body: string;
  user: string;
  avatarUrl: string;
  createdAt: string;
  htmlUrl: string;
  reviewId: number | null;
  /** parent id jika ini reply */
  inReplyToId: number | null;
  isOwn: boolean;
};

type DismissReviewInput = {
  reviewId: number;
  message: string; // required by GitHub
};
```

Fetcher terpisah `fetchIssueComments` — load saat tab **Files** aktif (bersama files/patch), jangan ikut fetch saat user di CI/AI saja.

Auth login: reuse `validateToken` / cache login yang sudah ada untuk flag `isOwn` (wajib di M9c edit/delete).

---

## 10. Permissions & error mapping

| Situasi                                                  | Perilaku UI                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| 401 / bad credentials                                    | Toast + arahkan Settings reconnect PAT                         |
| 403 secondary rate limit                                 | Toast + disable write ~cooldown; jangan auto-retry loop        |
| 403/404 insufficient scope                               | Jelaskan butuh scope `repo` (private) / public_repo sesuai PAT |
| 422 validation (reply tanpa body, dismiss tanpa message) | Inline field error                                             |
| Edit/delete bukan milik sendiri                          | GitHub 403 → toast; sembunyikan tombol via `isOwn`             |

Scope PAT: dokumentasikan di onboarding/settings bahwa write comments butuh token dengan akses isi repo yang relevan (sudah implisit untuk approve).

---

## 11. Milestones

| Milestone | Scope                                                 | Target  |
| --------- | ----------------------------------------------------- | ------- |
| **M9a**   | F21–F23 + F31–F32 (issue comments UI + rate-limit UX) | 📝 Next |
| **M9b**   | F24–F25 (reply inline + tampilan thread)              | 📝      |
| **M9c**   | F26–F29 (edit/delete own comments)                    | 📝      |
| **M9d**   | F30 (dismiss review)                                  | 📝      |
| **M10**   | F33–F34 + resolve threads **TBC**                     | Later   |

Urutan disarankan: **M9a → M9b → M9c → M9d** (value cepat dulu: conversation box; reply adalah inti “ikut thread”).

---

## 12. Risks

| Risk                                               | Mitigasi                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Secondary rate limit (sudah terjadi)               | Debounce tab fetch; cache ETag bila memungkinkan; write-then-patch lokal; F32         |
| `in_reply_to` vs `/replies` endpoint beda perilaku | Spike 0.5 hari di M9b; pilih satu; cover unit test mock                               |
| Comment orphan (reviewId null)                     | Tetap tampilkan di flat list “unattached inline”                                      |
| AI + manual reply race                             | Tidak lock; user bisa punya keduanya; refresh setelah post                            |
| Konflik scope vs manual annotate                   | Annotate line = PRD inline file comments; slice ini = conversation/reply/dismiss saja |

---

## 13. Open questions → keputusan (2026-09-09)

| #   | Pertanyaan                 | Keputusan                                                                 |
| --- | -------------------------- | ------------------------------------------------------------------------- |
| Q16 | Tab Conversation?          | ✅ Digabung ke tab **Files**                                              |
| Q17 | Reply endpoint?            | ✅ Prefer `in_reply_to` pada POST comments; spike singkat di M9b bila 422 |
| Q18 | Issue comment di drawer?   | ✅ Ya, **setelah** full-page Files/Conversation stabil                    |
| Q19 | Resolve thread di v0.3?    | ✅ Tidak — M10                                                            |
| Q20 | Komentar bot di list?      | ✅ Ya, read-only                                                          |
| Q21 | Dismiss hapus badge local? | ✅ Tidak otomatis                                                         |
| Q22 | Markdown preview?          | ✅ **Plain textarea** dulu; preview nanti bila perlu                      |

Tidak ada pertanyaan produk yang blocking M9a (issue comment di Files).

---

## 14. Acceptance criteria

### M9a

- [ ] Di tab **Files**, di bawah patch viewer ada section Conversation (list + compose)
- [ ] User bisa mengirim issue comment dan melihatnya di list tanpa membuka browser
- [ ] Template chip mengisi compose
- [ ] `postIssueComment` dipanggil dari UI (bukan hanya test)
- [ ] Saat GitHub mengembalikan secondary rate limit, UI menampilkan pesan jelas dan tidak me-retry agresif
- [ ] Tidak ada tab Conversation terpisah

### M9b

- [ ] Setiap inline comment punya aksi Reply
- [ ] Reply muncul terkait parent (nested atau “↳ reply to”)
- [ ] Unit test API untuk payload `in_reply_to` / replies

### M9c

- [ ] Edit/Delete hanya pada komentar own
- [ ] Delete minta konfirmasi; gagal menampilkan toast tanpa menghapus row lokal

### M9d

- [ ] Dismiss mengirim `message` non-empty
- [ ] Kartu review menampilkan state Dismissed setelah sukses

---

## 15. Out of scope checklist (agar PRD tetap realistis)

Jangan masukkan ke sprint ini kecuali Q di atas diubah:

- Clone repo / local IDE diff annotate (annotate di app = PRD inline, bukan clone)
- Auto-post AI replies ke thread
- Sync saved review history ke GitHub
- Analytics “comment SLA”
- OAuth App (tetap PAT)
- Melarang Approve+comments (itu diizinkan)

---

## 16. Relasi ke dokumen lain

- Product baseline & AI safety: [docs/PRD.md](./PRD.md)
- Positioning: [PRODUCT.md](../PRODUCT.md)
- Layer kode baru: taruh di `src/features/pr/api.ts` + panel di `features/pr/` atau section di `routes/ai-review.tsx` (thin extract jika route makin gemuk) — lihat [docs/ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 17. Ringkas keputusan produk

| Keputusan                                   | Pilihan                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| Sumber kebenaran komentar                   | GitHub API (bukan hanya localStorage)                                           |
| Write path                                  | Selalu aksi user eksplisit                                                      |
| Surfaced Conversation                       | **Digabung ke tab Files** (bukan tab sendiri, bukan digabung Reviews)           |
| Tiga mode review                            | Instant · AI · Manual — lihat PRD inline; slice ini tidak menggantikannya       |
| Approve + comments / approve setelah review | ✅ Diizinkan (dikunci di PRD inline)                                            |
| Prioritas value (slice ini)                 | Issue comment UI → Reply → Edit/Delete → Dismiss                                |
| AI                                          | Tidak diubah kontrak “confirm before post”; reply manual terpisah dari AI draft |
| Rate limit                                  | First-class UX, bukan afterthought                                              |
