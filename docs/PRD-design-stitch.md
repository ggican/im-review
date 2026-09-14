# PRD / Design Brief — IM Review → Google Stitch redesign

> **Status:** Draft v1.0 · **Owner:** Ikhsan Mahendri · **Updated:** 2026-09-15  
> **Purpose:** Analisis produk dari **kode yang ada sekarang**, lalu brief siap **copy-paste ke Google Stitch** untuk design UI baru.  
> **Source of truth:** current app codebase (`im-review` / Tauri desktop), bukan wishlist spekulatif.

---

## 0. Cara pakai di Google Stitch

1. Paste **§11 Stitch master prompt** (atau per-screen prompts di §12).
2. Attach logo: `public/im-review-logo.png` / `src/assets/im-review-logo.png` (cyan geometric mark on black).
3. Generate: **Desktop app UI · 1100×800 · light + dark**.
4. Prioritas screen: Today/Dashboard → PR detail → Jira → Gmail → Calendar → Settings.

---

## 1. Product (dari kode hari ini)

| Field | Value |
| --- | --- |
| **Name** | **IM Review** |
| **Platform** | Desktop macOS (Tauri 2), window ~1100×800 |
| **Stack UI** | React 19, Tailwind, Radix/shadcn-style, Lucide, Inter |
| **One-liner** | Satu tempat triage kerja engineering: GitHub PRs, Jira issues, Gmail, Google Calendar, plus AI review & metrics. |
| **Primary user** | Software engineer / reviewer yang handle banyak PR + tiket + meeting + email kerja per hari. |
| **Job to be done** | Buka app → lihat apa yang **needs me** → buka item → aksi (approve / comment / status / baca mail / join Meet) → lanjut tanpa tab-hop browser. |

### Positioning

Bukan Notion/todo umum. Bukan full Gmail/Jira/Calendar clone.  
= **Engineering work desk / unified inbox** dengan depth khusus di **GitHub PR review + AI (human confirm)**.

### Product principles (harus terbaca di design)

1. Operate mode — padat, scanable, keyboard-friendly (⌘K).
2. Status mencegah kerja dobel (`Already reviewed` / unread / done).
3. Source identity jelas (GitHub / Jira / Gmail / Calendar) tanpa terasa empat app berbeda.
4. AI = draft, manusia konfirmasi sebelum submit.
5. Secrets lokal — Settings = connect accounts, bukan marketing wall.

---

## 2. Informasi architecture (routes sekarang)

```
Onboarding (GitHub PAT)
    │
    ▼
Dashboard / PR lists          ← home hari ini (PR-centric)
├── People
├── Repos
├── Jira ──► Issue detail
├── Gmail ──► Message detail
├── Calendar ──► Event detail
├── Metrics
├── Settings (General · AI · Jira · Google · Templates · Favorites · History)
└── PR Review /detail ──► tabs: Detail · Files · CI · Reviews · AI
```

**Global chrome:** ⌘K command palette · tray icon · dock badge · native notifications · theme system/light/dark · sonner toasts.

---

## 3. Screen inventory (as-built)

### 3.1 Onboarding
- Centered form: paste GitHub PAT → Continue.
- Logo + short trust copy (token stays local).

### 3.2 Dashboard (PR hub) — `/`
**Header:** Logo · user name/@login · avatar · nav: People, Jira, Calendar, Gmail, Metrics, Repos, Settings, Sign out.

**Optional:** Red CI failure banner (your open PRs).

**Tabs:** All open · Favorites · Assigned · Review requested · Already reviewed · My open · (+ People tab optional).

**Each tab:** count + “N new”.

**List:** Sections Needs review / Already reviewed · rows · pagination 25.

**PR row:** title · #n · badges (New, draft, Already reviewed / Not reviewed + subtype Approved|Changes requested|Commented, Branch favorite) · repo · head→base · author · relative time · actions (star branch, copy, open GitHub).

**Toolbar:** Mark seen · Refresh · updated time · author filter chips.

### 3.3 PR detail — `/review/:owner/:repo/:number`
**Header:** Back · repo# · title · your-review badge/banner · meta (author, branches, +/− files) · Approve LGTM · Favorite branch · Open GitHub.

**Tabs:** PR detail · Files · CI · Reviews · AI review.

| Tab | Content |
| --- | --- |
| Detail | Own-PR controls · Quick approve + templates · description · metadata |
| Files | Diffs · line comment gutters · conversation · pending review bar |
| CI | Check runs |
| Reviews | GitHub reviews snapshot |
| AI | Run AI · findings checklist · refine · confirm · Submit |

### 3.4 Jira — `/jira` + `/jira/:issueKey`
**List:** Saved filters · type · label · include done · extra JQL · status tabs · grouped rows.  
**Row:** type icon · KEY · summary · status · assignee · points · parent · dates.  
**Detail:** chips · transition status · parent/subtasks · description · fields table · Open in Jira.

### 3.5 Gmail — `/gmail` + `/gmail/:messageId`
**Tabs:** Inbox · Unread (default) · Starred · Sent.  
**Controls:** Label · Gmail search · Refresh · Load more.  
**Row:** unread dot · from · subject · snippet · time.  
**Detail:** Mark read · Star · Archive · Open in Gmail · headers · body (text/HTML).

### 3.6 Calendar — `/calendar` + event detail
**Tabs:** Today · Upcoming · This week · All-day.  
**Controls:** Calendar picker · search · Refresh.  
**Row:** time · title · Meet tag · location.  
**Detail:** Join Meet · Open in Calendar · description · attendees.

### 3.7 People — `/people`
Favorites / Search · list + side panel open PRs by author.

### 3.8 Repos — `/repos`
Favorites / All · search · star · open PRs for repo.

### 3.9 Metrics — `/metrics`
Windows Today/7/14/30 · Scorecard / Suggestions / CI Health · 4 category cards · charts.

### 3.10 Settings — `/settings`
General · AI providers · Jira connect · Google OAuth · Templates · Favorites · History.

---

## 4. Visual system incumbents (jangan ditiru buta — ini “as-is”)

| Token | Current |
| --- | --- |
| Font | Inter 400/500/600 · mono for keys/branches |
| Layout | Centered column `max-w-3xl`/`4xl`, `px-6 py-8`, dense `text-xs`/`sm` |
| Surface | Neutral light/dark · bordered lists · pill tab tracks |
| Semantic | Sky=new/reviewed · Emerald=approve/+ · Red=CI/errors · Amber=favorites · Violet=AI |
| Logo | Cyan geometric “IM” mark on black square |

**Pain untuk redesign (observasi kode):**  
Nav horizontal crowded · tiap sumber (PR/Jira/Gmail/Calendar) silo · belum ada **Today unified inbox** · shell masih “PR app + halaman samping”, belum “work OS”.

---

## 5. Design goals untuk Stitch (yang kita mau)

1. **Shell baru:** sidebar atau top+rail yang setara untuk GitHub · Jira · Gmail · Calendar · Metrics · Settings.
2. **Today (opsional hero screen):** unified “Needs me” dari semua source — kalau Stitch hanya redesign existing home, jadikan Dashboard lebih “inbox” (PR tetap primary, slot untuk Jira/Mail/Cal teasers).
3. **Satu bahasa komponen:** list row, filter tabs, status badges, empty connect states, detail header actions.
4. **Brand-first tapi operate:** logo kuat di chrome; bukan landing page marketing.
5. **Light + dark** dari awal.
6. **Density:** desktop power-user; hindari card soup & empty whitespace berlebihan.
7. **Hindari:** purple SaaS gradient, Inter-on-cream cliché, rounded-full pill overload, glow, emoji.

---

## 6. Key components to design (system)

- App shell (nav + content)
- Source badge (GitHub / Jira / Gmail / Calendar)
- Status badges (Already reviewed, Unread, Draft, CI failed, Meeting)
- Filter tab bar + count chips
- Work list row (multi-source variants)
- Detail header (title + meta + primary actions)
- Empty state “Connect X in Settings”
- Settings connection cards
- Command palette (⌘K)
- Toast / notification preview with app logo
- AI review panel (findings list + confirm gate)

---

## 7. Priority screens untuk Stitch (urutan generate)

| P | Screen | Why |
| --- | --- | --- |
| P0 | App shell + Dashboard/Today | First impression |
| P0 | PR detail (Files + AI tabs) | Core differentiator |
| P1 | Jira list + issue detail | Parity work items |
| P1 | Gmail list + message read | Email triage |
| P1 | Calendar agenda + event | Meetings |
| P2 | Settings connections | Trust / onboarding accounts |
| P2 | Metrics scorecard | Secondary |
| P3 | Onboarding · People · Repos · ⌘K | Supporting |

---

## 8. Content / copy (English UI)

Use English labels in mocks (matches app):  
Already reviewed · Not reviewed · Needs review · Inbox · Unread · Join Meet · Open in GitHub/Jira/Gmail/Calendar · Run AI review · Submit review · Connect Google · Mark seen.

---

## 9. Non-goals untuk desain ini

- Mobile-first layouts (desktop primary).
- Full month calendar grid editor.
- Full rich email compose.
- Marketing landing / pricing page.
- Replacing GitHub/Jira web for every power feature.

---

## 10. Acceptance (design review)

Design lulus jika:

1. Dalam 3 detik jelas “ini work desk engineering”, bukan generic admin.
2. User bisa bedakan source & status di list tanpa baca tooltip panjang.
3. PR detail terasa deep (diff/AI), Gmail/Calendar terasa light triage.
4. Light & dark koheren dengan logo cyan/black.
5. Nav scale ke 6+ area tanpa overflow chaos.

---

## 11. STITCH MASTER PROMPT (copy-paste)

```text
Design a macOS desktop app UI for “IM Review” (engineering work desk).

PRODUCT
IM Review is a Tauri desktop app (≈1100×800) where a software engineer manages daily work in one place:
- GitHub pull requests (triage + AI-assisted review with human confirm before submit)
- Jira issues (my work, filters, status, detail)
- Gmail (inbox triage: list, tabs, read, mark read/star/archive)
- Google Calendar (agenda tabs, event detail, Join Meet)
- Personal engineering metrics
- Settings to connect GitHub PAT, Jira API token, Google OAuth, AI keys

NOT a generic todo app. NOT a full Gmail/Jira/Calendar clone.
Tone: dense, calm, power-user “Operate” UI. Keyboard-first (⌘K).

BRAND
- Name: IM Review (hero-level in chrome, not tiny nav only)
- Logo: sharp cyan/teal geometric mark on black rounded square (attach provided logo asset)
- Avoid: purple gradients, cream+serif terracotta clichés, Inter-default bland SaaS, emoji clutter, glassmorphism glow, oversized rounded pills

VISUAL DIRECTION
- Desktop app shell with clear navigation to: Today/PRs, Jira, Gmail, Calendar, Metrics, Settings
- Light AND dark themes
- High information density, excellent scanability
- Shared components: source badges, status badges, filter tab bars with counts, list rows, detail headers with actions, empty “Connect account” states
- Semantic colors: sky=new/reviewed, emerald=approve/success, red=CI/error/request changes, amber=favorites, distinct accent for AI

SCREENS TO GENERATE (high fidelity)
1) App shell + Dashboard / PR inbox
   - Header with logo, user, nav
   - Tabs: All open, Favorites, Assigned, Review requested, Already reviewed, My open
   - PR rows with badges: New, draft, Already reviewed / Not reviewed, Branch favorite
   - Sections Needs review vs Already reviewed
2) PR detail
   - Tabs: Detail, Files (diff + line comments), CI, Reviews, AI review
   - AI panel: findings checklist + confirm before submit
   - Banner when user already reviewed
3) Jira list + issue detail (filters, status tabs, KEY-summary rows, Open in Jira)
4) Gmail list + message reader (Inbox/Unread/Starred/Sent, unread dots, read actions)
5) Calendar agenda + event detail (Today/Upcoming/Week, Meet join)
6) Settings connections (GitHub, Jira, Google, AI providers) — clean trust UI

OUTPUT
- Desktop frames 1100×800
- Light + dark for shell + dashboard minimum
- Component annotations for badges, tabs, rows
- English UI copy
```

---

## 12. STITCH PER-SCREEN PROMPTS (opsional)

### 12.1 Dashboard
```text
IM Review desktop dashboard for GitHub PR triage. macOS window 1100x800.
Top chrome: cyan-black logo “IM Review”, user chip, nav links (People, Jira, Calendar, Gmail, Metrics, Repos, Settings).
Main: horizontal filter tabs with counts (Favorites selected), optional CI failure banner, dense PR list rows with status badges (Already reviewed / Not reviewed / New / draft), repo + branch metadata, right-side icon actions.
Dense operate UI, light theme, then dark theme variant. No marketing hero.
```

### 12.2 PR detail + AI
```text
IM Review PR detail screen. Left back button, title, Already reviewed badge, Approve and Open on GitHub actions.
Tabs: PR detail | Files | CI | Reviews | AI review.
AI tab shows draft findings as checklist with severity chips, refine chips, confirm checkbox, Submit review button (human gate).
Include a Files tab concept with diff lines and comment gutter. Dark theme preferred for code feel.
```

### 12.3 Gmail
```text
IM Review Gmail triage screen (not full Gmail clone). Tabs Inbox Unread Starred Sent. Message list: unread dot, from, subject, snippet, time. Detail pane or page: subject, headers, body, actions Mark read / Star / Archive / Open in Gmail. Match IM Review desktop shell and cyan-black brand.
```

### 12.4 Calendar
```text
IM Review Calendar agenda. Tabs Today Upcoming This week. Event rows with time, title, Meet tag. Event detail with Join Meet and Open in Calendar. Same desktop shell as IM Review. Calm dense layout.
```

### 12.5 Jira
```text
IM Review Jira My Work. Filter bar: saved filters, issue type, labels. Status tabs. Rows with ISSUE-KEY, summary, status chip, parent. Detail with transitions and Open in Jira. Same shell/brand as other IM Review screens.
```

---

## 13. Deliverables expected from Stitch

- [ ] Shell + nav system
- [ ] Dashboard / PR list (light + dark)
- [ ] PR detail (at least Detail + AI or Files)
- [ ] Jira list + detail
- [ ] Gmail list + read
- [ ] Calendar agenda + detail
- [ ] Settings connections
- [ ] Badge & tab component sheet (nice-to-have)

---

## 14. Related docs

| Doc | Role |
| --- | --- |
| [PRD.md](./PRD.md) | Master product |
| [PRD-jira.md](./PRD-jira.md) | Jira behavior |
| [PRD-google-calendar.md](./PRD-google-calendar.md) | Calendar behavior |
| [PRD-gmail.md](./PRD-gmail.md) | Gmail behavior |
| [PRD-github-review-comments.md](./PRD-github-review-comments.md) | Review/comment depth |
| This file | **Design / Stitch brief from current code** |

---

## 15. Ringkasan analisis (buat kamu)

**Yang sudah digabung di app:** GitHub + Jira + Gmail + Calendar + Metrics + AI review.  
**Yang design lama rasanya:** masih PR-app dengan halaman samping; nav padat; belum “one work OS”.  
**Yang Stitch harus selesaikan:** shell + visual language + parity list/detail across sources, tanpa mengorbankan depth PR/AI.
