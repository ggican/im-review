# PRD — Gmail: Inbox List, Tabs, Read Mail (v0.6)

> **Status:** Draft v0.6 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-15  
> **Parent:** [docs/PRD.md](./PRD.md) (IM Review product baseline)  
> **Sibling:** [PRD-google-calendar.md](./PRD-google-calendar.md) (shared Google OAuth account)  
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

Slice ini menambah permukaan **Gmail / Email** di IM Review: **lihat & triage** email kerja di satu app bersama PR, Jira, dan Calendar. **Bukan** full Gmail client — fokus **list → filter/tab → buka baca → aksi ringan → open in Gmail**.

Auth = **OAuth Google** yang sama dengan Calendar (satu Connect account). Tidak bisa “API key paste” seperti Jira.

**Setup tutorial:** [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md)

---

## 1. Ringkasan

Konteks kerja sering masuk lewat email: review request, Jira notify, CI fail, undangan meeting. User ingin **inbox work** di IM Review dengan pola yang sama seperti list lain:

| #   | Kemampuan                   | Perilaku                                                               |
| --- | --------------------------- | ---------------------------------------------------------------------- |
| 1   | **Connect Google** (shared) | OAuth sekali untuk Calendar + Gmail; disconnect membersihkan keduanya. |
| 2   | **List email**              | Row: from, subject, snippet, date, unread/star badges.                 |
| 3   | **Filter tabs**             | Inbox · Unread · Starred · Sent · (opsional Important).                |
| 4   | **Label filter**            | Dropdown/chip label Gmail (AND dengan tab).                            |
| 5   | **Search query**            | Box Gmail search (`is:unread from:…`) + Apply.                         |
| 6   | **Saved views**             | Chip lokal: nama + tab + label + query (restore satu klik).            |
| 7   | **Open / read**             | Detail in-app: headers + body (text/html sanitized); Open in Gmail.    |
| 8   | **Light actions**           | Mark read/unread, star/unstar, archive (modify scope).                 |

---

## 2. Baseline (sudah ada — jangan diulang sebagai “baru”)

| Capability                               | Bukti                                   | Status |
| ---------------------------------------- | --------------------------------------- | ------ |
| Google OAuth + token store + Settings UI | `google.rs`, secrets, Settings Calendar | ✅     |
| Calendar list MVP                        | `/calendar`                             | ✅     |
| Pola list/tabs/detail (PR, Jira)         | dashboard, `/jira`, `/jira/:key`        | ✅     |
| **Gmail API calls**                      | —                                       | ❌     |
| Route `/gmail` / `/gmail/:id`            | —                                       | ❌     |
| Gmail scopes di OAuth                    | Hanya `calendar.readonly` + userinfo    | ❌     |
| Settings copy “enable Gmail API”         | —                                       | ❌     |

---

## 3. Problem statement

1. Notifikasi kerja masuk Gmail; user tetap buka browser terpisah dari IM Review.
2. Butuh **triage cepat**: unread kerja, star, cari by label — bukan compose rich email.
3. Calendar sudah connected; menambah Gmail tanpa second login idealnya **satu Google account**.
4. Noise tinggi jika dump seluruh mailbox — default harus **Inbox/Unread** + query bounded.

---

## 4. Goals & non-goals

### Goals (v0.6 / M13b)

- G1. Perluas OAuth scopes: `gmail.readonly` dulu; `gmail.modify` untuk archive/star/mark read.
- G2. Re-consent flow jika user sudah connect Calendar-only (prompt reconnect).
- G3. Settings: enable **Gmail API** di Cloud Console; tab Google mencakup Calendar + Gmail status.
- G4. Route `/gmail` — tabs Inbox / Unread / Starred / Sent + search + label filter.
- G5. Route `/gmail/:messageId` — baca body, headers, Open in Gmail.
- G6. Actions: mark read, star, archive (jika modify scope granted).
- G7. Saved views lokal (nama + tab + labels + query).
- G8. Empty / connect CTA / 403 API disabled messaging.
- G9. Nav: **Gmail** di samping Calendar / Jira; ⌘K “Gmail”.

### Non-goals (M13b)

- ❌ Full compose / reply rich editor (reply plain TBC M14).
- ❌ Attachment download besar / inline image CDN kompleks (link out dulu).
- ❌ Multiple inboxes / Google Workspace admin.
- ❌ Offline sync full mailbox / IMAP.
- ❌ Replace Gmail web for long reading sessions.
- ❌ Send-as / signatures / filters management di Google.

---

## 5. Inventory Gmail API

Semua lewat Rust proxy (extend `google.rs`):

| Call          | Path                                     | Pakai untuk       |
| ------------- | ---------------------------------------- | ----------------- |
| Profile       | `gmail/v1/users/me/profile`              | email address     |
| Labels list   | `gmail/v1/users/me/labels`               | label filter      |
| Messages list | `gmail/v1/users/me/messages?q=&labelIds=`| list ids          |
| Messages get  | `gmail/v1/users/me/messages/{id}?format=`| metadata / full   |
| Modify        | `POST .../messages/{id}/modify`          | read/star/archive |
| Threads get   | `gmail/v1/users/me/threads/{id}`         | optional thread   |

**Default queries per tab:**

| Tab     | Query / labels          |
| ------- | ----------------------- |
| Inbox   | `label:inbox`           |
| Unread  | `label:inbox is:unread` |
| Starred | `is:starred`            |
| Sent    | `label:sent`            |

Max results bounded (25–50) + page token “Load more”.

**Scopes:**

```
openid
email
profile
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.modify
```

Mulai **readonly-only** untuk list+read jika ingin consent lebih ringan; actions disabled sampai modify — lihat QG2.

---

## 6. UX surfaces

### 6.1 Settings → Google

- Satu Connect untuk Calendar + Gmail.
- Status: email, scopes granted (Calendar ✅ / Gmail ✅).
- Jika Calendar connected tapi Gmail scope missing → banner **Reconnect to enable Gmail**.

### 6.2 `/gmail` — list

```
[ Inbox | Unread | Starred | Sent ]   [ Label ▾ ] [ Search… ] [ Refresh ]
Saved: Work unread · CI alerts
───────────────────────────────────────────────────────────────────────
● Alice <alice@…>    PR review requested for acme/web #42     2h
  Bob                [JIRA] PROJ-123 assigned to you           Yesterday
```

- Unread = bold / dot.
- Klik row → `/gmail/:id`.

### 6.3 `/gmail/:messageId` — detail

- Subject, From, To, Cc, Date, labels chips.
- Body: prefer `text/plain`; if only HTML → sanitize (no script) atau Open in Gmail fallback.
- Actions: Mark read · Star · Archive · Open in Gmail · Back.
- 📝 Related: parse `PROJ-123` / GitHub PR URL di body → deep link (TBC M14).

---

## 7. Data model (target)

```ts
type GmailMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  snippet: string;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
  bodyText: string | null;
  bodyHtml: string | null;
  permalink: string;
};

type GmailSavedView = {
  id: string;
  name: string;
  tab: "inbox" | "unread" | "starred" | "sent";
  labelIds: string[];
  query: string;
  createdAt: string;
  updatedAt: string;
};
```

---

## 8. Acceptance criteria

| ID  | Kriteria                                                           | Priority |
| --- | ------------------------------------------------------------------ | -------- |
| M1  | Connect Google dengan Gmail scope → `/gmail` load Inbox            | Must     |
| M2  | Tabs Inbox/Unread/Starred/Sent mengubah list                       | Must     |
| M3  | Search query + Apply memfilter list                                | Must     |
| M4  | Klik row → detail subject/from/body; Open in Gmail bekerja         | Must     |
| M5  | Mark read / star / archive update UI (jika modify scope)           | Must     |
| M6  | Tanpa connect → CTA Settings; tanpa Gmail scope → Reconnect banner | Must     |
| M7  | Saved view save/apply/delete                                       | Should   |
| M8  | Unit tests: map headers, tab→query, snippet helpers                | Must     |

---

## 9. Milestones

| Slice  | Scope                                            | Status |
| ------ | ------------------------------------------------ | ------ |
| M13b.0 | Scope + reconnect + Settings Google rename       | 📝     |
| M13b.1 | `/gmail` list + tabs + search                    | 📝     |
| M13b.2 | `/gmail/:id` read view + Open in Gmail           | 📝     |
| M13b.3 | Mark read / star / archive                       | 📝     |
| M13b.4 | Labels + saved views                             | 📝     |
| M14    | Reply plain + cross-link Jira/PR + unified notif | TBC    |

**Dependency:** M13a Calendar OAuth foundation ✅. Gmail builds on same `google.rs` token store.

---

## 10. Risks

- Gmail scope sensitif — copy readonly/modify harus jelas.
- HTML email XSS — sanitize atau text-only v1.
- Large threads / quota — page size + cache.
- Re-consent friction untuk user Calendar-only.
- App verification Google untuk distribusi production — OK Testing mode dulu.

---

## 11. Open questions

| #   | Pertanyaan                                | Jawaban sementara                |
| --- | ----------------------------------------- | ------------------------------- |
| QG1 | List by **message** atau **thread**?      | Message dulu; thread TBC        |
| QG2 | Start readonly only atau langsung modify? | Readonly list+read; modify .3   |
| QG3 | Body HTML sanitize?                       | Text-first v1                   |
| QG4 | Default tab?                              | **Unread**                      |
| QG5 | Nav “Google” vs “Gmail” + “Calendar”?     | Terpisah: **Gmail** · **Calendar** |
