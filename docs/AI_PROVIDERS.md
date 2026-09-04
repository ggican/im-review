# AI providers

IM Review generates **draft** PR reviews from GitHub patch text. A human must confirm before anything is posted to GitHub.

You can store API keys for multiple providers and select which one is **active**.

---

## Supported providers

| Id          | Label            | Key storage account                                     | Backend                                               |
| ----------- | ---------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| `cursor`    | Cursor           | `ai-key:cursor` (also migrates legacy `cursor-api-key`) | Local Cursor SDK (`scripts/cursor-local-prompt.mjs`)  |
| `openai`    | OpenAI           | `ai-key:openai`                                         | `POST https://api.openai.com/v1/chat/completions`     |
| `codex`     | OpenAI Codex     | `ai-key:codex`                                          | OpenAI-compatible Chat Completions (Codex/GPT models) |
| `anthropic` | Anthropic Claude | `ai-key:anthropic`                                      | `POST https://api.anthropic.com/v1/messages`          |
| `gemini`    | Google Gemini    | `ai-key:gemini`                                         | Gemini `generateContent` API                          |

Keys are stored in **local app storage** (`localStorage`) and loaded into Rust memory when the app starts. No macOS Keychain prompt.

---

## Setup (users)

1. Open **Settings → AI providers**
2. Paste a key for the provider you use
3. Click **Save key** (validates when possible)
4. Set **Active provider**
5. Open a PR → **AI review** → Run

You can keep several keys saved and switch active provider without re-entering secrets.

### Where to get keys

- Cursor: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations)
- OpenAI / Codex: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Anthropic: [console.anthropic.com](https://console.anthropic.com/)
- Gemini: [Google AI Studio](https://aistudio.google.com/apikey)

---

## Architecture (contributors)

```text
UI (Settings / AI review)
  → src/lib/api.ts  (save_ai_key, ai_review_pr, …)
  → src-tauri commands
       ├─ cursor  → run_local_cursor_prompt
       └─ openai / codex / anthropic / gemini → HTTP chat helpers
  → shared JSON schema (review_json_schema_rules)
  → draft JSON parsed in frontend
```

Shared prompt rules live in Rust (`review_json_schema_rules`, `patch_only_chat_rules`) so every provider returns the same draft shape:

```json
{
  "summary": "...",
  "suggestedEvent": "COMMENT" | "REQUEST_CHANGES" | "APPROVE",
  "findings": [{ "severity": "info|warning|critical", "title": "...", "body": "...", "path": "...", "line": 1 }]
}
```

---

## Adding a new provider

1. Add an id to the provider enum in:
   - `src/features/ai-review/providers.ts` (frontend)
   - `src-tauri/src/commands.rs` (match arms)
2. Keychain account: `ai-key:<id>`
3. Implement `validate_<id>_key` (cheap authenticated ping)
4. Implement chat call that returns **raw model text** (JSON object only)
5. Wire into `ai_review_pr` / `ai_refine_review`
6. Document the provider in this file and the README table
7. Never log the API key

### Checklist

- [ ] Key save / has / delete works
- [ ] Validate fails clearly on bad keys
- [ ] Review + refine both work
- [ ] Progress events still emit for the UI spinner
- [ ] README + this doc updated

---

## Security notes

- Prefer provider-scoped keys with minimal spend limits
- Rotate keys if a machine is shared or compromised
- Drafts may include PR patch text — treat provider ToS / data retention accordingly
