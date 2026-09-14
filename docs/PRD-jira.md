# PRD — Jira Connect: My Work, Filters, Detail (v0.5)

> **Status:** Draft v0.5 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-14  
> **Parent:** [docs/PRD.md](./PRD.md) (IM Review product baseline)  
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

Q8 di baseline sebelumnya **“Integrasi Jira? Tidak”** — dibuka ulang di sini. Slice ini **baca/lihat work item Jira**, bukan mengganti GitHub PR loop.

---

## 1. Ringkasan

IM Review mendapat permukaan **Jira** di samping daftar PR: connect site Atlassian, lihat work item **milik kita**, saring cepat, **simpan kombinasi filter**, klik sekali untuk buka lagi, plus **detail** (status, judul, parent / sub-task).

**Default list:** story (dan work item lain yang lolos filter) **assignee = currentUser()** — “by user name kita”, bukan scrape GitHub login.

### Yang harus bisa (dikunci dari request)

| #   | Kemampuan                        | Perilaku                                                                                                           |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | List by **username kita**        | Default JQL `assignee = currentUser()` (bounded). Bukan `assignee ~ "Ikhsan"` kecuali user override.               |
| 2   | List by **filter tersimpan**     | Chip / sidebar: klik nama → apply JQL + dropdown state.                                                            |
| 3   | List by **issue type**           | Dropdown: All / Story / Bug / Defect / Task / Sub-task / Epic / tipe lain dari site.                               |
| 4   | List by **label**                | Combobox label Jira; AND ke query.                                                                                 |
| 5   | **Semua kombinasi bisa di-save** | Nama filter lokal; satu klik restore. Opsional sync ke Jira saved filter.                                          |
| 6   | **Status + detail + parent**     | Row: key, title, status, type. Detail: status, summary, parent (supaya kelihatan sub-task vs story vs child lain). |

Filter **compose AND** (bukan tab yang saling menimpa tanpa jejak):

```
assignee = currentUser()
  AND type IN (...)          -- jika dropdown ≠ All
  AND labels = "foo"         -- jika label dipilih
  AND <extra JQL>            -- jika user isi query box
ORDER BY updated DESC
```

Kombinasi itu yang di-save, bukan hanya satu dimensi.

---

## 2. Baseline (sudah ada — jangan diulang sebagai “baru”)

| Capability                                | Bukti                                              | Status      |
| ----------------------------------------- | -------------------------------------------------- | ----------- |
| GitHub PAT + proxy Rust                   | `validate_token` / `github_get` / `github_request` | ✅          |
| Settings tabs, localStorage CRUD          | `lib/settings.ts`, `/settings`                     | ✅          |
| List + drawer + open-in-browser           | PR dashboard / `PRDetailDrawer`                    | ✅          |
| Favorite repos/branches (pola save lokal) | `im-review:favorites`                              | ✅          |
| **Jira HTTP / creds di app**              | —                                                  | ❌ belum    |
| Route `/jira`                             | —                                                  | ❌ belum    |
| Env `JIRA_*` di `~/.zshrc`                | Hanya skill Confluence CLI, **bukan** app          | ⚠️ terpisah |

Jangan baca token dari env shell user. Connect di Settings, simpan lewat pola secrets yang sama dengan GitHub (hydrate ke Rust; token tidak di-log).

---

## 3. Problem statement

Konteks kerja FE tiket **terpecah**: PR di IM Review, story/bug di Jira web.

1. Pagi: “story gue yang masih open apa, statusnya apa, ini sub-task atau story?” — harus buka Jira, ganti board, ingat filter.
2. Sering pakai kombinasi yang sama: _my Story + label `fe-review`_, _my Bug_, _semua sub-task gue_. Di Jira harus klik-klik lagi; di app belum ada.
3. Sub-task tanpa **parent** membingungkan di list datar — tidak kelihatan ini anak story mana.
4. JQL penuh power, tapi harian butuh **dropdown type + label + saved chip**, bukan textarea saja.

---

## 4. Goals & non-goals

### Goals (v0.5 / M12)

- G1. **Connect Jira Cloud**: site URL + email + API token; validate `GET /myself`; disconnect.
- G2. **My work default**: list assignee = current user; group/split by **status**.
- G3. Dropdown **issue type** (Story, Defect/Bug, Task, Sub-task, … dari API site).
- G4. Filter **label** (search/pilih; multi-label = AND, kecuali user ganti di extra JQL).
- G5. Extra **JQL** box (advanced), selalu bounded.
- G6. **Saved filters** lokal: nama + snapshot kontrol; klik chip = apply. CRUD rename/delete.
- G7. **Save to Jira** (starred/my filters) — create/update filter di Jira supaya muncul juga di jira.com.
- G8. **Issue row + detail**: key, title, status, type, labels, assignee, **parent** (key + summary + type), link buka Jira.
- G9. Rate-limit / error JQL jelas (400 unbounded, 401/403, 429).

### Non-goals (M12)

- ❌ Create / edit / transition / assign / comment Jira (baca dulu). Transition **TBC** M13.
- ❌ Jira Server / Data Center (Cloud REST v3 saja).
- ❌ Jira Software board / sprint UI penuh (sprint field boleh tampil di detail jika ada).
- ❌ Auto-link PR ↔ issue (parse `PROJ-123` di judul PR) — **TBC** M13, bukan blocker list.
- ❌ Confluence, JSM queue, Tempo, advanced roadmap Gantt.
- ❌ Multi-site Jira.
- ❌ Ganti GitHub dashboard; Jira = route/nav terpisah.

---

## 5. Inventory Jira Cloud API

Proxy Rust `jira_request` — Basic auth `email:api_token`, base `https://{site}.atlassian.net`. Path relatif `/rest/api/3/…`.

**Jangan** pakai `GET/POST /rest/api/3/search` (sudah **410 Gone**). Pakai enhanced search.

### Ditargetkan M12 📝

| ID  | Aksi produk                                                          | Method    | Path / catatan                                                                                                                       |
| --- | -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| J1  | Siapa saya (username, accountId, displayName, avatar)                | GET       | `/rest/api/3/myself`                                                                                                                 |
| J2  | Search work items                                                    | POST      | `/rest/api/3/search/jql` body `{ jql, maxResults, nextPageToken, fields }` — paginasi **nextPageToken**, tidak ada `total`/`startAt` |
| J3  | Issue types site                                                     | GET       | `/rest/api/3/issuetype` — isi dropdown (Story, Bug, Defect, …)                                                                       |
| J4  | Labels (suggest)                                                     | GET       | `/rest/api/3/label?startAt=&maxResults=` **atau** `/rest/api/3/jql/autocompletedata/suggestions?fieldName=labels&fieldValue=`        |
| J5  | Issue detail (jika search fields kurang: description, parent nested) | GET       | `/rest/api/3/issue/{key}?fields=summary,status,issuetype,parent,labels,assignee,priority,updated,comment,description,subtasks`       |
| J6  | My Jira filters                                                      | GET       | `/rest/api/3/filter/my` dan `/rest/api/3/filter/favourite`                                                                           |
| J7  | Create Jira filter                                                   | POST      | `/rest/api/3/filter` `{ name, jql, favourite: true }`                                                                                |
| J8  | Update / delete Jira filter                                          | PUT / DEL | `/rest/api/3/filter/{id}`                                                                                                            |
| J9  | Approximate count (opsional badge)                                   | POST      | `/rest/api/3/search/approximate-count`                                                                                               |

### Fields wajib di J2 (default search hanya `id`)

```
summary, status, issuetype, parent, labels, assignee, priority, updated, created, project
```

`parent` = epic/story induk (termasuk sub-task). `issuetype.subtask === true` menandai sub-task.

### Default JQL (G2)

```
assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC
```

Bounded (`assignee = currentUser()`). Toggle **Include done** menukar `resolution = Unresolved` → hapus klausa itu (masih bounded).

---

## 6. User flows

### 6.1 Connect

```
Settings → Jira
  Site URL (https://xxx.atlassian.net)
  Email
  API token
        │
        ▼ Connect
  jira_request GET /myself
        │
        ▼
  Simpan creds (pola GitHub) · tampil displayName + avatar
  Nav "Jira" muncul
```

Tanpa connect: `/jira` empty state + CTA Settings. GitHub tetap jalan.

### 6.2 My work (default)

```
[/jira]
  Built-in chip [My work] aktif
  type = All (atau last used)
  label = none
        │
        ▼ J2
  Group by status (section header) atau statusCategory
        │
        ▼ klik row → drawer detail (6.5)
```

### 6.3 Compose filter (type + label + JQL)

```
Dropdown Type     → Story | Bug/Defect | Task | Sub-task | Epic | All | (tipe site lain)
Combobox Label    → AND labels = "x" (multi: labels = x AND labels = y)
JQL extra         → ditambah AND ( ... ) jika non-empty
        │
        ▼ Apply (debounce 400ms / Enter)
  Rebuild JQL · J2 · list + split status
```

Type dropdown **bukan** hardcode “Story/Defect” saja — isi dari J3, urutan pin: Story, Bug, Defect, Task, Sub-task, Epic, lalu sisanya A–Z. Item yang tidak ada di site tidak ditampilkan.

### 6.4 Save & klik sekali (inti request)

```
[Save filter]
  Nama wajib (unik lokal)
  Snapshot: { name, jql, typeIds[], labels[], extraJql, includeDone, groupBy }
        │
        ▼
  Chip di sidebar "Saved" · persist localStorage
        │
        ▼ klik chip
  Restore kontrol + fetch · highlight chip aktif
```

Aksi per chip: Apply · Rename · Delete · **Save to Jira** (J7, M12c).

Built-in (tidak bisa hapus): **My work**. User boleh **Save as…** dari My work + type/label.

Import: M12c tarik J6 ke list lokal (read-only sampai “Save copy locally”).

### 6.5 Detail (status, title, parent)

```
Klik row / ⌘O
        │
        ▼ Drawer
  Key · Type icon · Status lozenge
  Summary (title)
  Parent: KEY — title · type   ← kosong jika issue top-level
  "Sub-task of …" jika issuetype.subtask
  Labels, assignee, priority, updated
  Description (ADF → text/markdown sederhana)
  [Open in Jira]
```

Parent wajib ada di **row** (satu baris secondary) **dan** drawer supaya list tetap bisa discan: `TIX-1234 · Sub-task of TIX-1200 Checkout polish`.

---

## 7. Functional requirements

| ID  | Requirement                                                                         | Priority | API            | Status      |
| --- | ----------------------------------------------------------------------------------- | -------- | -------------- | ----------- |
| F60 | Settings: connect/disconnect Jira (URL, email, token); validate myself              | Must     | J1             | 📝          |
| F61 | Route `/jira` + nav header (sejajar Repos / Metrics)                                | Must     | —              | 📝          |
| F62 | Default list `assignee = currentUser()` + unresolved                                | Must     | J2             | 📝          |
| F63 | Split/group list by **status** (nama status, urutan statusCategory lalu name)       | Must     | J2             | 📝          |
| F64 | Dropdown **issue type** dari J3; All = tidak menambah klausa type                   | Must     | J3             | 📝          |
| F65 | Filter **label** (suggest + free text yang valid); clear                            | Must     | J4             | 📝          |
| F66 | Extra JQL; 400 unbounded / syntax → inline error, list tidak dikosongkan diam-diam  | Must     | J2             | 📝          |
| F67 | Saved filters lokal CRUD; klik apply; chip aktif                                    | Must     | —              | 📝          |
| F68 | Built-in **My work**; Save as menandai `source: "local"`                            | Must     | —              | 📝          |
| F69 | Row: key, title, status, type, **parent key+title** (atau “No parent”)              | Must     | J2             | 📝          |
| F70 | Drawer detail: status, title, type, parent, labels, assignee, description, open URL | Must     | J5 bila perlu  | 📝          |
| F71 | Sub-task badge jika `issuetype.subtask`; parent wajib di-fetch (field `parent`)     | Must     | J2/J5          | 📝          |
| F72 | Open in browser `https://{host}/browse/{key}`                                       | Must     | —              | 📝          |
| F73 | Pagination nextPageToken; cap halaman (mis. 3×100) + “Load more”                    | Must     | J2             | 📝          |
| F74 | Empty/loading/error; 401 → reconnect                                                | Must     | —              | 📝          |
| F75 | List my/favourite Jira filters; apply JQL-nya                                       | Should   | J6             | 📝          |
| F76 | Save to Jira / update jika `jiraFilterId` sudah ada                                 | Should   | J7/J8          | 📝          |
| F77 | Toggle Include done                                                                 | Should   | —              | 📝          |
| F78 | Group by statusCategory (To Do / In Progress / Done) sebagai alternatif             | Could    | —              | 📝          |
| F79 | Filter assignee **orang lain** (people slice)                                       | Could    | J2             | **TBC** M13 |
| F80 | Transition status dari drawer                                                       | Could    | transition API | **TBC** M13 |
| F81 | Deep-link PR yang menyebut issue key                                                | Could    | GitHub         | **TBC** M13 |

---

## 8. UX surfaces

### Nav

Dashboard header: **Jira** (disabled + tooltip “Connect in Settings” jika belum). ⌘K: “Jira — My work”, saved filter names.

### `/jira` layout (mirror Repos: list + panel)

```
┌─ Saved ────────────┬─ Toolbar ─────────────────────────────┐
│ ○ My work          │ Type ▾   Label ▾   Include done       │
│ ○ Bugs this sprint │ [JQL extra…                    ] Save │
│ ○ FE review label  │                                       │
│                    ├─ In Progress (4) ─────────────────────┤
│                    │ TIX-1  Title                 Status   │
│                    │        Sub-task of TIX-9 Parent title │
│                    ├─ To Do (2) ───────────────────────────┤
│                    │ …                                     │
└────────────────────┴───────────────────────────────────────┘
```

Drawer detail overlay kanan / bottom sheet sempit — pola `PRDetailDrawer`.

### Settings → tab **Jira**

Paste site URL + email + API token, **Save key** / **Remove key** (pola tab AI). Status: `displayName <email> @ host`. Bukan mencampur token ke tab AI.

### Saved filter chip

- Nama + optional type/label summary (`Story · label:fe`)
- Active = selected tab style (sudah ada di PRList)
- Overflow menu: Rename, Duplicate, Delete, Save to Jira

---

## 9. Data model (client)

```ts
type JiraStatus = {
  id: string;
  name: string;
  category: "new" | "indeterminate" | "done" | "unknown";
  colorName?: string;
};

type JiraIssueType = {
  id: string;
  name: string;
  iconUrl: string;
  subtask: boolean;
};

type JiraParent = {
  key: string;
  summary: string;
  typeName: string;
  typeSubtask: boolean;
} | null;

type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  status: JiraStatus;
  type: JiraIssueType;
  parent: JiraParent;
  labels: string[];
  assignee: { displayName: string; avatarUrl: string } | null;
  priority: string | null;
  updatedAt: string;
  browseUrl: string;
};

type JiraIssueDetail = JiraIssue & {
  descriptionText: string;
  projectKey: string;
  subtaskKeys: string[];
};

type JiraSavedFilter = {
  id: string; // local uuid
  name: string;
  jql: string; // compiled, for fetch + save-to-Jira
  typeIds: string[]; // empty = All
  labels: string[];
  extraJql: string;
  includeDone: boolean;
  groupBy: "status" | "statusCategory";
  jiraFilterId?: string; // set after F76
  createdAt: string;
  updatedAt: string;
};

type JiraConnectionPublic = {
  host: string; // tiket.atlassian.net
  email: string;
  displayName: string;
  accountId: string;
  avatarUrl: string;
};
```

Storage:

| Key                            | Isi                                                               |
| ------------------------------ | ----------------------------------------------------------------- |
| Secrets (pola GitHub)          | `host` + `email` + `apiToken` — token **jangan** di JSON settings |
| `im-review:jira-public`        | `JiraConnectionPublic` (non-secret)                               |
| `im-review:jira-saved-filters` | `JiraSavedFilter[]`                                               |

Compiled JQL helper (pure, unit-test):

```ts
function compileJql(p: {
  typeNames: string[];
  labels: string[];
  extraJql: string;
  includeDone: boolean;
}): string;
```

Selalu prefix `assignee = currentUser()`. Extra JQL user **tidak** boleh menimpa itu diam-diam; jika extra berisi `assignee =`, tampilkan warning 📝 (tetap jalankan extra sebagai AND, atau block — **Q36**).

Layer: `src/features/jira/` (`api.ts`, `types.ts`, `jql.ts`, `hooks.ts`, `JiraPage.tsx`, `JiraIssueRow.tsx`, `JiraIssueDrawer.tsx`). Route thin `routes/jira.tsx`. Rust: `jira_request` + `validate_jira` di `commands.rs`.

---

## 10. Permissions & error mapping

| Situasi                        | UI                                                         |
| ------------------------------ | ---------------------------------------------------------- |
| Belum connect                  | Empty `/jira` + Connect                                    |
| 401 / 403                      | Toast + Settings reconnect (token salah / captcha / scope) |
| 400 JQL unbounded / syntax     | Pesan dari `errorMessages[]` di bawah JQL box              |
| 429                            | Toast retry-after; jangan loop                             |
| Issue type/label 404           | Abaikan opsi; dropdown tetap dari J3                       |
| Save to Jira 400 nama duplikat | Minta nama lain                                            |
| Description ADF kompleks       | Fallback plain text; jangan crash                          |

Auth: **Basic** email + API token (Atlassian Cloud). Bukan OAuth di M12.

---

## 11. Milestones

| Milestone | Scope                                                                                | Target           |
| --------- | ------------------------------------------------------------------------------------ | ---------------- |
| **M12a**  | F60–F63, F69–F74 — connect, My work, split status, row+parent, drawer, open Jira     | 📝 value pertama |
| **M12b**  | F64–F68, F77 — type dropdown, label, extra JQL, **saved filters lokal + klik apply** | 📝               |
| **M12c**  | F75–F76 — list filter Jira, save/update ke Jira                                      | 📝               |
| **M13**   | F78–F81 — group category, assignee orang lain, transition, PR↔key                    | Later            |

Urutan: **M12a → M12b → M12c**. Tanpa save (M12b) dropdown type/label tetap berguna; save adalah cara “tinggal klik”.

---

## 12. Risks

| Risk                                 | Mitigasi                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| `/search` lama 410                   | Hanya `/search/jql` + `fields` eksplisit + `nextPageToken`  |
| Unbounded JQL 400                    | Default selalu `assignee = currentUser()`; extra JQL di-AND |
| Site pakai “Bug” vs “Defect”         | Dropdown dari J3, jangan hardcode satu nama                 |
| Parent hilang di search              | Minta field `parent`; fallback J5 saat buka drawer          |
| Token tertukar dengan Confluence env | Connect in-app; jangan `JIRA_API_TOKEN` dari zsh            |
| Filter Jira share/permission         | Create dengan favourite; jangan set share org di MVP        |
| List besar                           | Cap + Load more; group by status di client setelah fetch    |

---

## 13. Open questions → keputusan (2026-09-14)

| #   | Pertanyaan                             | Keputusan                                                                                                                    |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Q32 | Cloud vs Server?                       | ✅ **Jira Cloud** REST v3                                                                                                    |
| Q33 | Default “by username”?                 | ✅ `assignee = currentUser()` (akun token), bukan string displayName / GitHub login                                          |
| Q34 | Type dropdown isi?                     | ✅ Dari API site; pin Story/Bug/Defect/Task/Sub-task/Epic jika ada                                                           |
| Q35 | Multi-label?                           | ✅ AND (`labels = a AND labels = b`). OR hanya lewat extra JQL                                                               |
| Q36 | Extra JQL override assignee?           | ✅ **Tidak otomatis.** Extra di-AND. Jika terdeteksi klausa `assignee`, warning; user bisa Save as filter khusus (tetap AND) |
| Q37 | Save lokal vs Jira?                    | ✅ Lokal **Must** (M12b). Save to Jira **Should** (M12c)                                                                     |
| Q38 | Transition dari app?                   | ✅ Tidak di M12 — baca status saja                                                                                           |
| Q39 | Satu list campur type vs tab per type? | ✅ Satu list + dropdown type (bukan 5 tab). Saved chip untuk kombinasi sering                                                |
| Q40 | Group UI?                              | ✅ Section by **status name** dulu (F63). Category = Could                                                                   |
| Q41 | Description rich text?                 | ✅ Plain dari ADF di M12; markdown penuh later                                                                               |
| Q42 | Filter “story only” default?           | ✅ Default type = **All** unresolved mine. User Save “My stories” jika mau type=Story                                        |

Tidak ada pertanyaan blocking M12a.

---

## 14. Acceptance criteria

### M12a

- [ ] Connect/disconnect Jira di Settings; `/myself` sukses menyimpan displayName
- [ ] `/jira` menampilkan issue assignee current user, di-group by status
- [ ] Setiap row: key, title, status, type; parent kelihatan (atau “No parent”)
- [ ] Sub-task menampilkan parent key + title
- [ ] Drawer: status, title, type, parent, open in Jira
- [ ] Tanpa creds: empty + CTA; GitHub dashboard tidak rusak

### M12b

- [ ] Dropdown type memfilter list (Story / Bug / Defect / … / All)
- [ ] Label memfilter list; clear mengembalikan tanpa klausa labels
- [ ] Extra JQL error tampil inline
- [ ] Save filter (nama) → muncul di daftar → klik apply mengembalikan type+label+JQL+list
- [ ] Rename/delete saved filter; My work tidak terhapus

### M12c

- [ ] Bisa lihat filter my/favourite dari Jira dan apply
- [ ] Save to Jira membuat filter; error nama duplikat jelas
- [ ] `jiraFilterId` tersimpan di filter lokal setelah sukses

---

## 15. Out of scope checklist

- Auto-create Jira dari PR
- Edit summary/status
- Board kanban drag-and-drop
- Time tracking / story points sebagai filter wajib (boleh tampil di detail jika field ada, **TBC**)
- Slack / email notifikasi Jira
- Pakai token env `JIRA_API_TOKEN` tanpa connect UI

---

## 16. Relasi ke dokumen lain

- Baseline + Q8: [docs/PRD.md](./PRD.md)
- People/author GitHub (terpisah, tidak memakai Jira assignee): [PRD-favorite-users.md](./PRD-favorite-users.md)
- Polar HTTP proxy: [docs/ARCHITECTURE.md](./ARCHITECTURE.md) — tambah `features/jira/` + `jira_request`
- Rate-limit UX: ikut pola [PRD-github-review-comments.md](./PRD-github-review-comments.md)

---

## 17. Ringkas keputusan produk

| Keputusan          | Pilihan                                             |
| ------------------ | --------------------------------------------------- |
| Jira di IM Review? | ✅ Ya (baca list + detail)                          |
| Default list       | `assignee = currentUser()` + unresolved             |
| Type / label / JQL | Compose AND + dropdown/combobox                     |
| Saved filters      | Lokal dulu, klik chip = apply; Jira sync menyusul   |
| Detail             | Status, title, type, **parent** (sub-task vs story) |
| Write/transition   | Bukan M12                                           |
| Auth               | Email + API token, proxy Rust, site Cloud           |
| Search endpoint    | `/rest/api/3/search/jql` saja                       |
