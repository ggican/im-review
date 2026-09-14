# PRD — Google Calendar: Agenda, Tabs, Detail (v0.6)

> **Status:** Draft v0.6 · **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-15  
> **Parent:** [docs/PRD.md](./PRD.md) (IM Review product baseline)  
> **Sibling:** [PRD-gmail.md](./PRD-gmail.md) (shared Google OAuth account)  
> Legenda: ✅ sudah pasti/terpasang · 📝 disepakati tapi belum dibangun · 🚧 sedang dikerjakan · **TBC** = to be confirmed

Slice ini menambah permukaan **Calendar** di IM Review: lihat agenda kerja tanpa buka calendar.google.com. **Bukan** pengganti Google Calendar penuh — fokus **list → filter/tab → buka detail → open in Google**.

Auth Google = **OAuth** (bukan API key paste). Satu Connect Google di Settings melayani Calendar + Gmail (lihat sibling PRD).

**Setup tutorial:** [GOOGLE_OAUTH.md](./GOOGLE_OAUTH.md)

---

## 1. Ringkasan

Engineer sering bolak-balik tab: PR, Jira, lalu Calendar untuk “meeting apa hari ini / jam berapa Meet-nya”. IM Review harus punya **agenda work** dengan pola interaksi yang sama dengan list lain di app:

| #   | Kemampuan                    | Perilaku                                                                  |
| --- | ---------------------------- | ------------------------------------------------------------------------- |
| 1   | **Connect Google** (sekali)  | OAuth Desktop client; simpan refresh token lokal; disconnect.             |
| 2   | **List events**              | Agenda tergrup per hari; row: judul, waktu, lokasi/Meet hint.             |
| 3   | **Filter tabs**              | Today / Upcoming (7d) / This week / All-day only — ganti window query.    |
| 4   | **Filter calendar source**   | Dropdown primary + calendars lain yang user subscribe (multi-select TBC). |
| 5   | **Search / query**          | Cari judul event (client-side dulu; API `q=` jika perlu).                 |
| 6   | **Open / detail**            | In-app detail: waktu, deskripsi, attendees, Meet link, Open in Calendar.  |
| 7   | **Quick actions**            | Join Meet (jika ada), copy link, refresh.                                 |
| 8   | **Saved views (opsional)**   | Chip lokal: nama + tab + calendar filter — pola sama saved filter lain.   |

---

## 2. Baseline (sudah ada)

| Capability                                      | Bukti                                           | Status             |
| ----------------------------------------------- | ----------------------------------------------- | ------------------ |
| Google OAuth PKCE + localhost redirect          | `src-tauri/src/google.rs`                       | ✅                 |
| Scope Calendar readonly + userinfo              | `SCOPES` di `google.rs`                         | ✅                 |
| Secrets + hydrate Google tokens                 | `src/lib/secrets.ts`, hydrate command           | ✅                 |
| Settings tab Calendar (connect/disconnect)      | `src/routes/settings.tsx`                       | ✅                 |
| Route `/calendar` + nav dari dashboard          | `src/router.tsx`, `dashboard.tsx`               | ✅                 |
| List next 7 days, group by day, open htmlLink   | `src/features/calendar/CalendarPage.tsx`        | ✅ MVP             |
| Fetch `primary` events only                     | `google_calendar_events`                        | ✅ MVP             |
| Tabs Today / Week / calendar picker / detail UI | —                                               | ❌                 |
| Event detail route/panel (in-app)               | — (klik langsung buka browser)                  | ❌                 |
| Meet link parse + Join button                   | —                                               | ❌                 |
| Gmail scopes / Gmail routes                     | —                                               | ❌ (lihat Gmail)   |

---

## 3. Problem statement

1. “Meeting apa hari ini sebelum review PR?” — harus buka Calendar web terpisah.
2. MVP sekarang hanya **primary · 7 hari · klik = browser** — tidak ada tab Today vs Upcoming, tidak ada detail in-app, tidak ada filter calendar lain.
3. Meet link sering terkubur di description — butuh **Join** sekali klik.
4. Connect Google sudah ada; perlu **naikkan Calendar ke parity list UX** (tabs + detail) tanpa jadi full calendar grid editor.

---

## 4. Goals & non-goals

### Goals (v0.6 / M13a)

- G1. Pertahankan Connect Google OAuth; dokumentasikan enable **Google Calendar API** di Cloud Console.
- G2. Tabs: **Today** · **Upcoming (7d)** · **This week** (Sen–Min lokal) · optional **All-day**.
- G3. List row: title, time range, all-day badge, location short, Meet indicator.
- G4. **Detail** `/calendar/:eventId` (atau drawer): description, attendees, hangout/Meet link, Open in Google Calendar.
- G5. **Join Meet** jika `hangoutLink` / conferenceData ada.
- G6. Calendar source: minimal `primary`; 📝 `calendarList.list` + filter chip.
- G7. Refresh manual + empty/error states (401 reconnect, 403 API not enabled).
- G8. ⌘K: jump ke Calendar (+ upcoming titles opsional).

### Non-goals (M13a)

- ❌ Create / edit / delete events.
- ❌ Drag-drop week/month grid editor (view mode TBC later).
- ❌ Multiple Google accounts.
- ❌ Push “meeting in 5m” (TBC unified notif M14).
- ❌ Room booking / resource admin.

---

## 5. Inventory Google Calendar API

| Call          | Path                                         | Pakai untuk        |
| ------------- | -------------------------------------------- | ------------------ |
| OAuth token   | `oauth2.googleapis.com/token`                | connect + refresh ✅ |
| Userinfo      | `oauth2/v2/userinfo`                         | email/name ✅      |
| Events list   | `calendar/v3/calendars/{id}/events`          | list ✅ primary    |
| Event get     | `calendar/v3/calendars/{id}/events/{eventId}`| detail 📝          |
| Calendar list | `calendar/v3/users/me/calendarList`          | source filter 📝   |

Query list: `timeMin`, `timeMax`, `singleEvents=true`, `orderBy=startTime`, `maxResults`.

**Scopes (Calendar):** `calendar.readonly` + `userinfo.email` + `userinfo.profile`.  
Saat Gmail ditambah → **re-consent** scope gabungan (lihat [PRD-gmail.md](./PRD-gmail.md)).

---

## 6. UX surfaces

### 6.1 Settings → Calendar (existing)

- Client ID (+ optional secret) · Connect · Disconnect · status email.
- Copy: enable Calendar API; OAuth Desktop; Testing → add test user.
- 📝 Setelah Gmail live: tab/label **Google** (Calendar + Gmail), satu Connect.

### 6.2 `/calendar` — list

```
[ Today | Upcoming | This week ]   [ Calendar ▾ ] [ Search… ] [ Refresh ]
───────────────────────────────────────────────────────────────────────
TODAY
  10:00–10:30  Standup · Meet                         →
  All day      Sprint planning
TOMORROW
  14:00–15:00  Design review
```

- Tab mengubah `timeMin` / `timeMax`.
- Klik row → **detail in-app** (bukan langsung browser). Detail punya Open in Calendar.

### 6.3 `/calendar/:eventId` — detail

- Title, when, calendar name, location.
- Description (plain / linkified).
- Attendees (truncated +N).
- Actions: Join Meet · Open in Google · Back.

---

## 7. Data model (target)

```ts
type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  htmlLink: string;
  location: string | null;
  description: string | null;
  hangoutLink: string | null;
  allDay: boolean;
  startMs: number;
  endMs: number;
  attendees?: Array<{ email: string; displayName?: string; self?: boolean }>;
};
```

MVP type hari ini belum punya `description` / `hangoutLink` / `calendarId` — diperluas saat detail.

---

## 8. Acceptance criteria

| ID  | Kriteria                                                                | Priority |
| --- | ----------------------------------------------------------------------- | -------- |
| C1  | Connected user melihat tab Today dengan event hari ini (timezone lokal) | Must     |
| C2  | Upcoming = 7 hari; This week = batas minggu lokal                       | Must     |
| C3  | Klik event → detail in-app; Open in Calendar → `htmlLink`               | Must     |
| C4  | Meet link tampil sebagai Join jika ada                                  | Must     |
| C5  | Disconnect → empty + CTA Settings; token cleared                             | Must     |
| C6  | Error API not enabled punya copy + link enable                          | Should   |
| C7  | Unit tests: map event, group by day, tab window helpers                 | Must     |

---

## 9. Milestones

| Slice  | Scope                                         | Status  |
| ------ | --------------------------------------------- | ------- |
| M13a.0 | OAuth + primary 7d list + open browser        | ✅ Done |
| M13a.1 | Tabs Today / Upcoming / This week             | 📝      |
| M13a.2 | In-app detail + Meet join                     | 📝      |
| M13a.3 | calendarList filter + search                  | 📝      |
| M13a.4 | Shared Google settings + scope bundle w/ Gmail| 📝      |

---

## 10. Risks

- OAuth Testing mode: refresh token / test user limit.
- `primary` saja bisa miss calendar kerja shared → calendarList.
- All-day timezone edge cases (parse date vs dateTime sudah ada di `api.ts`).
- Scope expansion for Gmail forces re-login.

---

## 11. Open questions

| #   | Pertanyaan                         | Jawaban sementara      |
| --- | ---------------------------------- | --------------------- |
| QC1 | Detail = route atau drawer?        | Route `/calendar/:id` |
| QC2 | Default tab saat buka?             | Today                 |
| QC3 | Multi-calendar default?            | Primary only dulu     |
| QC4 | Notif “meeting soon”?              | TBC M14               |
