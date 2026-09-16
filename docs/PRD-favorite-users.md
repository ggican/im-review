# PRD — Search / Filter PR by User & Favorite People (v0.4)

> **Status:** Draft v0.4 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-14  
> **Parent:** [docs/PRD.md](./PRD.md) (IM Review product baseline)  
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

---

## 1. Ringkasan

**Ya, bisa.** Slice ini menambah dua kemampuan yang saling melengkapi di dashboard IM Review:

1. **Cari / filter PR berdasarkan GitHub user** — lihat PR milik seseorang (bukan hanya PR yang nunggu kita).
2. **Favorite people** — pin user yang sering kita review / pantau, lalu pakai mereka sebagai shortcut filter & list.

Pola produk **meniru favorite repos** (CRUD lokal + filter dashboard), bukan fitur sosial GitHub (tidak follow, tidak notifikasi ke orang lain).

Dua mode pencarian **keduanya masuk scope**, dengan peran berbeda:

| Mode             | Apa yang terjadi                                                  | Kapan dipakai                                                                                   |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Filter**       | Saring list tab yang sedang aktif, client-side, `pr.author.login` | Cepat, 0 extra GitHub Search, terbatas PR yang sudah ter-load                                   |
| **List by user** | Fetch GitHub Search `is:pr is:open author:{login}`                | Lihat **semua** open PR author itu yang PAT bisa lihat, termasuk yang tidak ada di tab sekarang |

---

## 2. Baseline (sudah ada — jangan diulang sebagai “baru”)

| Capability                                                                                        | Bukti di kode                                                    | Status                       |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| PR sudah punya `author.login` + `avatarUrl`                                                       | `PullRequest` di `src/features/pr/types.ts`                      | ✅                           |
| GitHub Search Issues untuk list PR                                                                | `searchPrs` → `GET /search/issues?q=…` di `features/pr/api.ts`   | ✅                           |
| Query authored sendiri                                                                            | `fetchMyOpenPrs` → `is:pr is:open author:@me`                    | ✅                           |
| Tab dashboard: All / Favorites (repos) / Assigned / Review requested / Already reviewed / My open | `PRList` + `useMyPRs`                                            | ✅                           |
| Favorite **repos** CRUD lokal                                                                     | `im-review:favorites` di `lib/settings.ts`                       | ✅                           |
| Favorite **branches** CRUD lokal                                                                  | `im-review:favorite-branches`                                    | ✅                           |
| Command palette ⌘K search PR by title/repo                                                        | `CommandPalette`                                                 | ✅                           |
| User GitHub yang login                                                                            | `GithubUser` (`login`, `name`, `avatar_url`) via `validateToken` | ✅                           |
| Search / star **user** (people)                                                                   | —                                                                | ❌ belum                     |
| Filter dashboard by author                                                                        | —                                                                | ❌ belum (hanya filter repo) |

Author sudah tampil di row PR, tapi **bukan kontrol filter** dan **bukan pin**.

---

## 3. Problem statement

Reviewer di org besar (banyak author, banyak repo) sering butuh:

1. **“PR si X mana saja yang masih open?”** — misalnya teammate, mentee, atau author yang PR-nya sering kita review. Hari ini harus ganti tab GitHub / ketik search manual.
2. **Saring list yang sudah terbuka** — tab Favorites/All kadang padat; ingin lihat hanya PR dari 1–2 orang tanpa fetch baru.
3. **Shortcut orang yang sama berulang-ulang** — favorite repos sudah ada; **favorite people belum**. Tiap kali harus ingat login.
4. Command palette hanya cari judul/repo, **bukan** `@login`.

Tanpa slice ini, user tetap terjebak di “PR yang nunggu gue” (`assignee` / `review-requested` / `author:@me`) dan “semua PR di favorite **repos**”.

---

## 4. Goals & non-goals

### Goals (v0.4 / M11)

- G1. **Filter author** pada tab dashboard yang aktif (client-side, instant).
- G2. **List PR by user** lewat GitHub Search `author:{login}` (open PRs).
- G3. **Favorite people** CRUD lokal (add / remove / list), persist reload.
- G4. Shortcut: chip favorite people + star author dari PR row.
- G5. Cari GitHub user by login/name untuk ditambahkan ke favorites (bukan hanya dari PR yang kebetulan terlihat).
- G6. Rate-limit sadar: jangan N Search call paralel untuk N favorite users.

### Non-goals

- ❌ Follow / unfollow GitHub, GitHub Stars pada user, atau sync ke akun GitHub.
- ❌ Filter by **reviewer** / requested reviewer sebagai MVP (bisa M12).
- ❌ Multi-select author (AND/OR banyak orang sekaligus) di filter chip — MVP = **satu** user aktif. Favorite-people **list** (agregat banyak author) terpisah, lihat F47.
- ❌ Team / org roster otomatis (`/orgs/{org}/members`) — **TBC** M12.
- ❌ Metrics scorecard per-orang lain (privacy + noise).
- ❌ GitLab / Bitbucket.
- ❌ Sync favorite people antar mesin (sama Q15: lokal saja).
- ❌ Ganti makna tab **Favorites** yang sekarang = favorite **repos**. Tab itu tetap repos.

---

## 5. Inventory GitHub API

Semua lewat `api.githubGet` / `api.githubRequest` (Rust proxy). Path relatif ke `https://api.github.com`.

### Sudah dipakai ✅

| Aksi               | Method | Path / query                                              |
| ------------------ | ------ | --------------------------------------------------------- |
| Search PRs         | GET    | `/search/issues?q={q}&per_page=100&page={n}&sort=updated` |
| My open            | GET    | `q=is:pr is:open author:@me`                              |
| Authenticated user | GET    | `/user` (via validate token)                              |

### Ditargetkan M11 📝

| ID  | Aksi produk                                         | Method | Path / catatan                                                                                                                          |
| --- | --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| A10 | List open PR by author                              | GET    | `/search/issues?q=is:pr+is:open+author:{login}` — **reuse `searchPrs`**                                                                 |
| A11 | List open PR by banyak author (favorite people tab) | GET    | Satu query `is:pr is:open (author:a OR author:b OR …)` per batch ≤ **8 login**; sequential batch jika lebih. Jangan 1 request per user. |
| A12 | Cari user GitHub                                    | GET    | `/search/users?q={query}&per_page=10`                                                                                                   |
| A13 | Resolve login → avatar/name                         | GET    | `/users/{login}` — untuk star manual / favorite yang belum ada di search result                                                         |

### Cadangan M12+ (API ada, sengaja ditunda) **TBC**

| Aksi                                                    | API                                | Alasan tunda                           |
| ------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| PR yang _involves_ user (author + commenter + assignee) | `involves:{login}`                 | Semantik lebih noisy; MVP = author     |
| PR assigned ke user                                     | `assignee:{login}`                 | Bukan request awal                     |
| Anggota org                                             | `GET /orgs/{org}/members`          | Perlu pilih org; permission bervariasi |
| Suggestion from collaborators                           | `GET /repos/{o}/{r}/collaborators` | Mahal per-repo                         |

Search API: max 100/page, 1000 results, **secondary rate limit mudah kena** — pakai cap halaman yang sama (`SEARCH_MAX_PAGES`, mulai 2) seperti `fetchMyOpenPrs`.

---

## 6. User flows

### 6.1 Filter author di dashboard (G1)

```
[Dashboard · tab apa pun]
        │
        ▼ ketik di Author combobox (login / nama yang sudah terlihat)
  suggestions = authors di list aktif ∪ favorite people
        │
        ▼ pilih @alice
  list tab di-filter author.login === "alice" (case-insensitive)
        │
        ▼ [Clear] menghapus filter; tab & fetch tidak berubah
```

Tidak memanggil GitHub. Empty: “No open PRs by @alice in this list.” + aksi **Show all PRs by @alice** → flow 6.2.

### 6.2 List PR by user (G2, A10)

```
[Author combobox · Enter login yang tidak ada di list]
        atau
[Favorite chip / People page · klik user]
        atau
[Empty filter · Show all PRs by @alice]
        │
        ▼
  searchPrs("is:pr is:open author:alice")
        │
        ▼
  Hasil di permukaan "By @alice" (bukan menimpa cache tab Assigned/Favorites)
        │
        ▼ user bisa star @alice ke favorite people
```

Hasil **ephemeral** sampai user Clear / pilih user lain / pindah tab biasa. Cache per-login boleh (localStorage, TTL pendek) agar Refresh & rate-limit tidak kosong — pola sama `pr-cache` **TBC** implementasi detail (F48).

### 6.3 Tambah favorite person (G3–G5)

Sumber add (semua toggle yang sama):

1. Star di **avatar/login author** pada `PRRow` / drawer.
2. Star di hasil search user (People page / combobox).
3. Settings → Favorites → People → input login → Add (resolve A13; 404 = toast).

Remove: star off, Settings row, People page.

Persist: `localStorage` key baru, **bukan** key favorite repos.

### 6.4 Favorite people sebagai shortcut (G4)

- Chip di toolbar dashboard (max ~8 terlihat; sisanya overflow “+N”).
- Klik chip = pasang author filter jika user itu ada di list aktif; kalau 0 hasil, tawarkan / langsung **list by user** (6.2).
- Chip aktif punya state selected; klik lagi = clear.

### 6.5 People page (G5) — M11c

```
Nav People (sejajar Repos)
        │
        ▼ tab Favorites | Search
  Favorites: list pin + open-PR count (lazy, on expand/click)
  Search: A12 → rows + star
        │
        ▼ klik user
  Panel kanan / bawah: open PRs (A10) — pola RepoOpenBranchesPanel
```

---

## 7. Functional requirements

| ID  | Requirement                                                                                                                                                | Priority    | API     | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- | ------ |
| F40 | Combobox **Author** di toolbar `PRList` (search login, keyboard, clear)                                                                                    | Must        | —       | 📝     |
| F41 | Filter client-side `author.login` pada tab aktif; count tab **tidak** berubah (count = unfiltered)                                                         | Must        | —       | 📝     |
| F42 | Empty filter menampilkan CTA **Show all PRs by @{login}**                                                                                                  | Must        | A10     | 📝     |
| F43 | Fetch open PRs `author:{login}`; tampil di view “By @{login}”                                                                                              | Must        | A10     | 📝     |
| F44 | Favorite people CRUD lokal (`get` / `toggle` / `remove` / `isFavoriteUser`)                                                                                | Must        | —       | 📝     |
| F45 | Star author di `PRRow` (terpisah dari star **branch**)                                                                                                     | Must        | —       | 📝     |
| F46 | Chip favorite people di dashboard (klik = filter / list by user)                                                                                           | Must        | —       | 📝     |
| F47 | Opsional: tab dashboard **People** = agregat open PR semua favorite users (A11), setting `showFavoritePeople` default **off** supaya tab tidak makin ramai | Should      | A11     | ✅     |
| F48 | Cache hasil A10 per login (stale banner jika rate-limit, seperti tab lain)                                                                                 | Should      | —       | 📝     |
| F49 | `GET /search/users` untuk autocomplete / halaman People                                                                                                    | Must (M11c) | A12     | 📝     |
| F50 | Resolve `GET /users/{login}` saat Add manual; tolak login invalid / 404                                                                                    | Should      | A13     | 📝     |
| F51 | Settings → Favorites: section **People** (list + remove + add by login)                                                                                    | Must        | A13     | 📝     |
| F52 | ⌘K: query `@alice` / `user alice` → filter dashboard atau buka PRs by user                                                                                 | Should      | A10     | 📝     |
| F53 | Route `/people` (Favorites + Search + PR list per user)                                                                                                    | Should      | A10/A12 | 📝     |
| F54 | Login dinormalisasi: trim, tanpa `@`, case-insensitive store **canonical login** dari GitHub bila A13/A12 sukses                                           | Must        | —       | 📝     |
| F55 | Query A11 di-batch (OR, sequential); hormati secondary rate limit (reuse `isGithubRateLimitError`)                                                         | Must        | A11     | 📝     |
| F56 | Qualifier default **author** saja; `involves` / `assignee` tidak di UI v0.4                                                                                | Must        | —       | 📝     |

---

## 8. UX surfaces

### Dashboard `/` — toolbar `PRList`

Urutan (kiri → kanan, wrap di sempit):

1. Tab list (tetap).
2. **Author** combobox (lebar ~12–16rem) + Clear.
3. Chip favorite people (jika ada).
4. Aksi existing (Mark seen, Refresh).

View “By @{login}” mengganti isi list **tanpa** menambah tab permanen di row tab (tab sudah 6). Indikator: pill di combobox + heading list `Open PRs by @alice (N)`.

Tab **Favorites** tetap = favorite **repos**. Jangan rename.

### `PRRow`

- Avatar/login author **bisa diklik** → pasang filter author (dashboard).
- Star kecil pada author (tooltip “Favorite person”) **terpisah** dari star branch (amber yang sudah ada). Jangan satu kontrol untuk dua makna.

### Settings → Favorites

Tiga section berurutan:

1. Repos (existing)
2. Branches (existing)
3. **People** (baru) — avatar, login, optional name, Remove

### Route `/people` (M11c)

Mirror `/repos`: search, star, klik user → open PRs. Nav button di header dashboard (sejajar Repos / Metrics).

### Command palette

Group **People**: favorite users + match query. Enter → `/?author=alice` atau navigate `/people?user=alice` (**TBC** URL sync — Q28).

---

## 9. Data model (client)

```ts
/** GitHub login, canonical (as returned by API when resolved). */
type FavoriteUser = {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
  favoritedAt: string;
};

type AuthorFilter = {
  /** null = no filter */
  login: string | null;
  /**
   * "filter" = client-side on current tab
   * "search" = GitHub list-by-author (view By @login)
   */
  mode: "filter" | "search";
};
```

Storage:

| Key                              | Isi                                       |
| -------------------------------- | ----------------------------------------- |
| `im-review:favorite-users`       | `FavoriteUser[]`                          |
| (existing) `im-review:favorites` | repo `owner/name[]` — **jangan dicampur** |

Store **object** (bukan `string[]` login saja) supaya chip punya avatar tanpa fetch tiap render. Jika user di-star dari PR row, isi `name` boleh `null` dulu; hydrate A13 lazy **TBC** (boleh skip di M11a).

Cap: **50** favorite people (prevent OR-query gila). Toast jika penuh.

Helper di `lib/settings.ts` + `useFavoriteUsers()` di `lib/use-settings.ts` — pola sama repos/branches.

Fetcher baru di `features/pr/api.ts`:

```ts
fetchOpenPrsByAuthor(login: string): Promise<PullRequest[]>
fetchOpenPrsByAuthors(logins: string[]): Promise<PullRequest[]>
searchGithubUsers(query: string): Promise<FavoriteUser[]> // tanpa favoritedAt
fetchGithubUser(login: string): Promise<FavoriteUser>
```

Layer UI People: `src/features/people/` (page + row), sesuai [ARCHITECTURE.md](./ARCHITECTURE.md). Filter dashboard tetap di `features/pr/` (`PRList` / hooks).

---

## 10. Permissions & error mapping

| Situasi                                 | Perilaku UI                                                              |
| --------------------------------------- | ------------------------------------------------------------------------ |
| User tidak ditemukan (A13 404)          | Toast “GitHub user @{login} not found”; jangan simpan favorite           |
| Search users kosong                     | Empty “No users match”                                                   |
| 403 secondary rate limit                | Stale cache bila ada; toast sama seperti list PR; jangan auto-retry loop |
| 401                                     | Settings reconnect PAT                                                   |
| Login invalid (`@`, spasi, >39 char)    | Inline error sebelum network                                             |
| PAT tidak melihat PR private author itu | List kosong / sebagian — empty jujur, bukan error                        |

Scope PAT: sama seperti list PR sekarang (`repo` untuk private). Tidak perlu scope baru.

---

## 11. Milestones

| Milestone | Scope                                                                     | Target                                                                        |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **M11a**  | F40–F42, F44–F46, F51, F54 (filter + favorite CRUD + star row + Settings) | 📝 pertama — value cepat, 0 Search baru kecuali empty CTA boleh menyusul M11b |
| **M11b**  | F43, F48, F55, F56 (list-by-author + batch OR + cache)                    | 📝                                                                            |
| **M11c**  | F47, F49–F50, F52–F53 (`/people`, user search, ⌘K, tab People opsional)   | 📝                                                                            |

Urutan: **M11a → M11b → M11c**. M11a sudah menjawab “filter by user + pin orang”; M11b menjawab “list semua PR dia”; M11c menjawab “cari user yang belum muncul di list”.

Empty CTA F42 di M11a boleh disable / copy “coming next” jika A10 belum di-wire; lebih baik F42+F43 ikut M11b sebagai satu slice fetch.

**Keputusan implementasi M11a:** F42 tanpa fetch dulu (copy: “Not in this list.” tanpa tombol Show all) **atau** F42+F43 digeser M11b. Rekomendasi: **CTA hidup di M11b**. M11a = filter + favorites saja.

---

## 12. Risks

| Risk                                          | Mitigasi                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| Secondary rate limit (Search)                 | Reuse cap halaman; batch OR; sequential; cache per login; F55 |
| Tab dashboard sudah padat                     | Jangan tab baru di M11a; chip + combobox; F47 default off     |
| Star author vs star branch tertukar           | Dua kontrol, dua label aria, tooltip berbeda                  |
| Login vs name (display)                       | Store `login` sebagai id; tampilkan `name` jika ada           |
| `author:Foo` case                             | GitHub login case-insensitive; bandingkan lowercase di filter |
| Query OR terlalu panjang                      | Batch 8 login; cap 50 favorites                               |
| Mencampur favorite repos & people di satu tab | Nama UI: **Favorites** = repos; **People** = users            |

---

## 13. Open questions → keputusan (2026-09-14)

| #   | Pertanyaan                                            | Keputusan                                                                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Q23 | Filter tab vs fetch by author — pilih satu?           | ✅ **Keduanya.** Filter = client-side pada tab aktif. Fetch = view “By @login”.                   |
| Q24 | Qualifier `author` / `assignee` / `involves`?         | ✅ MVP **author** saja. Lainnya M12.                                                              |
| Q25 | Halaman `/people` wajib di sprint pertama?            | ✅ Tidak. M11c. M11a cukup dashboard + Settings.                                                  |
| Q26 | Seed default favorite people (seperti repo tiket/\*)? | ✅ **Tidak.** List kosong sampai user pin.                                                        |
| Q27 | Author filter AND dengan tab (mis. Favorites repos)?  | ✅ Ya untuk mode **filter**. Mode **search** mengabaikan tab (semua repo yang Search kembalikan). |
| Q28 | Sync filter ke URL (`?author=`)?                      | ✅ Ya, supaya ⌘K / deep-link / refresh aman. M11b.                                                |
| Q29 | Tab dashboard “People” (agregat favorites)?           | ✅ Should, **default off** (F47).                                                                 |
| Q30 | Favorite org (bukan user)?                            | ✅ Tidak di v0.4.                                                                                 |
| Q31 | Klik author di row = filter atau buka GitHub profile? | ✅ **Filter** di dashboard. Profile GitHub tetap via `htmlUrl` di People/Settings (external).     |

Tidak ada pertanyaan yang blocking M11a.

---

## 14. Acceptance criteria

### M11a

- [x] Combobox Author memfilter list tab aktif tanpa request GitHub baru
- [x] Clear mengembalikan list penuh tab itu
- [x] Star author di row menambah/menghapus favorite person; persist reload
- [x] Chip favorite people di dashboard memasang filter
- [x] Settings → Favorites → People: list + remove + add by login (404 ditolak)
- [x] Star **branch** tidak berubah perilaku
- [x] Tab Favorites (repos) tidak di-rename dan tidak menampilkan people

### M11b

- [x] “Show all PRs by @login” / mode search memanggil `searchPrs` dengan `author:{login}`
- [x] Hasil tidak menimpa cache tab Assigned / Favorites / dll.
- [x] `?author=` di URL restore filter/search
- [x] Rate limit: stale/error jelas, tidak spam retry
- [x] Beberapa favorite users di-fetch via query OR bertahap (bila F47 on)

### M11c

- [x] `/people` search user GitHub + star
- [x] Klik user menampilkan open PRs
- [x] ⌘K `@login` menuju filter atau halaman people
- [x] Nav People di header dashboard

---

## 15. Out of scope checklist

Jangan masukkan ke sprint M11 kecuali Q di atas diubah:

- Auto-pin author dari “Already reviewed”
- Notifikasi native khusus favorite people
- Unread / “new PR by favorite person” terpisah dari watermark seen yang sudah ada (boleh reuse badge New yang existing)
- Mentions / involvements
- Export/import favorite people
- OAuth / multi-akun

---

## 16. Relasi ke dokumen lain

- Product baseline: [docs/PRD.md](./PRD.md) — favorite **repos** = M7 (F13–F15)
- Architecture: layer `features/people/` + `lib/settings.ts` — [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- Rate limit UX: ikut pola [PRD-github-review-comments.md](./PRD-github-review-comments.md) G6 / F32
- Design: favorite amber hanya untuk star — [DESIGN.md](../DESIGN.md)

---

## 17. Ringkas keputusan produk

| Keputusan                          | Pilihan                                               |
| ---------------------------------- | ----------------------------------------------------- |
| Apakah bisa search/filter by user? | ✅ Ya                                                 |
| Filter vs list-by-user             | Keduanya: filter client-side **dan** GitHub `author:` |
| Qualifier                          | `author` saja                                         |
| Favorite people storage            | Lokal, key terpisah dari favorite repos               |
| Seed                               | Tidak ada                                             |
| Tab Favorites existing             | Tetap = repos                                         |
| Halaman People                     | M11c, bukan blocker M11a                              |
| Star di row                        | Dua star: person vs branch                            |
| Rate limit                         | First-class; batch OR; cache per login                |
| AI / review loop                   | Tidak diubah                                          |
