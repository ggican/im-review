# Google OAuth — Tutorial (Calendar & Gmail)

> **Owner:** Ikhsan Mahendri · **Last updated:** 2026-09-15  
> Shared sign-in for **Calendar** + **Gmail**. Not an API-token paste like Jira.

Related: [PRD-google-calendar.md](./PRD-google-calendar.md) · [PRD-gmail.md](./PRD-gmail.md) · Unit matrix: [testing/features/google/unit.md](./testing/features/google/unit.md)

---

## 1. Konsep singkat

| Peran | Yang dilakukan |
| --- | --- |
| **Developer / build** | Buat OAuth Desktop client sekali di Google Cloud; set `VITE_GOOGLE_OAUTH_CLIENT_ID` + `VITE_GOOGLE_OAUTH_CLIENT_SECRET` di `.env`; rebuild |
| **End user** | Settings → **Google** → **Connect Google** → login akun Google (kantor/pribadi) → Allow |

- Satu Connect = Calendar + Gmail (scopes digabung).
- Refresh token disimpan lokal di mesin user (bukan di server IM Review).
- Redirect lokal: `http://127.0.0.1:17320` (PKCE + Desktop client).
- Google **memerlukan** `client_secret` saat tukar authorization code (error `client_secret is missing` jika kosong).

---

## 2. Setup developer (sekali per product)

### 2.1 Buat Google Cloud project

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. **Select a project** → **New project** (contoh nama: `im-review`)
3. Jika error `resourcemanager.projects.create`: akun kantor diblok create project — pakai Gmail pribadi untuk **project**, atau minta IT buatkan project.  
   **Connect nanti tetap bisa pakai akun Google kantor.**

### 2.2 Enable API

**APIs & Services → Library** (atau search):

- Enable **Google Calendar API**
- Enable **Gmail API**

### 2.3 OAuth consent / Audience

UI baru sering di **Google Auth Platform**:

1. **Branding** — app name `IM Review`, support email, developer contact
2. **Audience**
   - Publishing status: **Testing** (awal)
   - **Test users** → tambahkan setiap email yang akan Connect (wajib untuk Testing), contoh akun kantor Anda
3. **Data Access** — pastikan scopes Calendar + Gmail + userinfo tersedia (app meminta saat Connect)

Tanpa Test user → browser: `403 access_denied` / “has not completed the Google verification process”.

### 2.4 Buat OAuth Desktop client

1. Sidebar **Clients** → **Create client**
2. Application type: **Desktop app**
3. Name: `IM Review Desktop`
4. Create → catat:
   - **Client ID** (`….apps.googleusercontent.com`)
   - **Client secret**

### 2.5 Isi `.env` (jangan commit)

Di root repo (`pr-helper/.env`), contoh dari `.env.example`:

```bash
VITE_GOOGLE_OAUTH_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxx
```

Restart Vite / `pnpm tauri dev` setelah mengubah `.env`.

### 2.6 Build production

Set env yang sama di CI / mesin build sebelum `pnpm tauri build`. End user **tidak** mengisi Client ID/secret di UI.

---

## 3. Connect (end user / QA)

1. Jalankan app → **Settings** → tab **Google**
2. Klik **Connect Google**
3. Browser login Google (pilih akun yang sudah jadi **Test user** jika status Testing)
4. Allow scopes Calendar + Gmail
5. Tab callback menampilkan sukses; kembali ke app → status **Connected**

### Jika browser tidak terbuka

Saat Waiting:

- Field **Google sign-in URL** muncul
- Klik **Copy URL** atau select + paste ke browser
- Selesaikan login di browser; biarkan app tetap Waiting sampai callback selesai

### Jika menutup browser di tengah jalan

- Klik **Cancel** di Settings (melepas port `17320`)
- Baru Connect lagi  
  Tanpa Cancel, Connect ulang bisa gagal `Address already in use`

### Reconnect / Disconnect

- **Reconnect** — grant ulang scopes (mis. setelah app menambah Gmail)
- **Disconnect** — hapus token lokal; Calendar & Gmail ikut putus

---

## 4. Troubleshooting

| Gejala | Penyebab umum | Perbaikan |
| --- | --- | --- |
| Tombol Connect disabled + pesan missing env | Build tanpa Client ID/secret | Isi kedua `VITE_GOOGLE_*`, restart |
| `403 access_denied` / not verified | Testing + email belum Test user | Audience → Add test users |
| `400 invalid_request` / `client_secret is missing` | Secret kosong / tidak di-pass | Isi `VITE_GOOGLE_OAUTH_CLIENT_SECRET`, rebuild |
| `Could not bind … 17320 (Address already in use)` | Listener OAuth sebelumnya masih hidup | Cancel, atau Connect ulang (auto-cancel), tunggu sebentar |
| `Google sign-in timed out` | Browser ditutup / tidak selesai dalam ~3 menit | Connect lagi; pakai Copy URL jika perlu |
| Calendar/Gmail 403 API | API belum enable di project | Enable Calendar API + Gmail API |
| Akun kantor diblok IT | Workspace block unapproved OAuth apps | Minta admin allow Client ID / app |

---

## 5. Alur teknis (referensi)

```
Settings Connect
  → ensureGoogleOAuthClient() (simpan id/secret lokal)
  → invoke google_oauth_connect(clientId, clientSecret)
  → bind 127.0.0.1:17320
  → emit google-oauth-url + open browser
  → user Allow → redirect localhost?code=…
  → exchange code (+ PKCE verifier + client_secret) → tokens
  → setGoogleTokens + hydrateRuntimeSecrets
```

Kode utama:

- `src/lib/google-oauth.ts` — env Client ID/secret
- `src/lib/api.ts` — `connectGoogle` / `cancelGoogleConnect`
- `src/lib/secrets.ts` — token lokal + hydrate
- `src/routes/settings.tsx` — UI Connect / Copy URL / Cancel
- `src-tauri/src/google.rs` — OAuth PKCE, cancel, Calendar/Gmail API

---

## 6. Checklist go-live (internal)

- [ ] Project Cloud + Calendar API + Gmail API enabled
- [ ] Desktop OAuth client + secret di build env
- [ ] Test users (atau publish + verification bila perlu Gmail production)
- [ ] Connect akun kantor sukses; `/calendar` dan `/gmail` load data
- [ ] Cancel + Connect ulang tidak menyisakan port 17320
- [ ] `.env` tidak ikut commit / release notes tidak memuat secret
