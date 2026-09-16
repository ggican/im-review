# UNIT — Google OAuth (Calendar & Gmail)

Feature slug: `google`  
Modules: `lib/google-oauth.ts`, `lib/secrets.ts` (Google keys), `lib/api.ts` (connect/cancel), `routes/settings.tsx` (Google tab)  
Hermetic only — no real Google / network / credentials.

Tutorial: [docs/GOOGLE_OAUTH.md](../../GOOGLE_OAUTH.md)

| ID              | Pri | Behavior                                                             | Reference         | Status | Remaining risk        |
| --------------- | --- | -------------------------------------------------------------------- | ----------------- | ------ | --------------------- |
| UNIT-GOOGLE-001 | P0  | Valid Client ID must contain `.apps.googleusercontent.com`           | `google-oauth.ts` | passed | —                     |
| UNIT-GOOGLE-002 | P0  | Pair configured only when ID valid **and** secret non-empty          | `google-oauth.ts` | passed | —                     |
| UNIT-GOOGLE-003 | P0  | Whitespace-only secret → not configured                              | `google-oauth.ts` | passed | —                     |
| UNIT-GOOGLE-004 | P0  | `ensureGoogleOAuthClient` persists id+secret; hydrate prefers env    | `secrets.ts`      | passed | mocked env module     |
| UNIT-GOOGLE-005 | P0  | `setGoogleTokens` / `hasGoogleCreds` / `clearGoogleCreds` round-trip | `secrets.ts`      | passed | —                     |
| UNIT-GOOGLE-006 | P0  | `connectGoogle` invokes with clientId+clientSecret; stores tokens    | `lib/api.ts`      | passed | mock invoke           |
| UNIT-GOOGLE-007 | P0  | `cancelGoogleConnect` invokes `google_oauth_cancel`                  | `lib/api.ts`      | passed | mock invoke           |
| UNIT-GOOGLE-008 | P0  | `deleteGoogle` clears creds and re-hydrates                          | `lib/api.ts`      | passed | mock invoke           |
| UNIT-GOOGLE-009 | P1  | Settings Connect → Connected profile; Disconnect clears              | `settings.tsx`    | passed | mock api              |
| UNIT-GOOGLE-010 | P1  | While waiting, OAuth URL event shows field + Copy URL                | `settings.tsx`    | passed | mock listen/clipboard |
| UNIT-GOOGLE-011 | P1  | Cancel while waiting calls `cancelGoogleConnect`                     | `settings.tsx`    | passed | deferred promise      |
| UNIT-GOOGLE-012 | P2  | Cancelled connect surfaces soft toast, not hard error                | `settings.tsx`    | passed | —                     |

## Out of unit (this matrix)

- Live Google Cloud / browser OAuth (manual — see tutorial)
- Rust `google.rs` accept/bind races (manual / cargo integration)
- Calendar/Gmail list UI (`features/calendar`, `features/gmail` tests)

## Verification (2026-09-15)

```bash
pnpm exec vitest run src/lib/google-oauth.test.ts src/lib/core.test.ts src/lib/api.test.ts src/routes/settings.test.tsx
# → 4 files, 32 passed
```
