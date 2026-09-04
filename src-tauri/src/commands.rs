use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

const UA: &str = "im-review/0.1";
const CURSOR_API: &str = "https://api.cursor.com/v1";
const OPENAI_API: &str = "https://api.openai.com/v1";
const ANTHROPIC_API: &str = "https://api.anthropic.com/v1";
const GEMINI_API: &str = "https://generativelanguage.googleapis.com/v1beta";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("no token stored")]
    NoToken,
    #[error("no {provider} api key stored")]
    NoAiKey { provider: String },
    #[error("unknown ai provider: {0}")]
    UnknownAiProvider(String),
    #[error("github error {status}: {message}")]
    Github { status: u16, message: String },
    #[error("cursor error {status}: {message}")]
    Cursor { status: u16, message: String },
    #[error("ai provider error ({provider}) {status}: {message}")]
    AiProvider {
        provider: String,
        status: u16,
        message: String,
    },
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

type Result<T> = std::result::Result<T, Error>;

fn github_token_store() -> &'static Mutex<Option<String>> {
    static STORE: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(None))
}

fn ai_key_store() -> &'static Mutex<HashMap<String, String>> {
    static STORE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn known_ai_providers() -> &'static [&'static str] {
    &["cursor", "openai", "codex", "anthropic", "gemini"]
}

fn normalize_provider(provider: &str) -> Result<()> {
    if known_ai_providers().contains(&provider) {
        Ok(())
    } else {
        Err(Error::UnknownAiProvider(provider.to_string()))
    }
}

fn load_token() -> Result<String> {
    github_token_store()
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .filter(|t| !t.trim().is_empty())
        .ok_or(Error::NoToken)
}

fn load_ai_key(provider: &str) -> Result<String> {
    normalize_provider(provider)?;
    ai_key_store()
        .lock()
        .ok()
        .and_then(|map| map.get(provider).cloned())
        .filter(|t| !t.trim().is_empty())
        .ok_or(Error::NoAiKey {
            provider: provider.to_string(),
        })
}

#[derive(Serialize)]
pub struct GithubUser {
    login: String,
    name: Option<String>,
    avatar_url: String,
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    step: String,
    message: String,
    detail: Option<String>,
}

fn emit_progress(app: &AppHandle, step: &str, message: &str, detail: Option<String>) {
    let _ = app.emit(
        "cursor-review-progress",
        ProgressPayload {
            step: step.to_string(),
            message: message.to_string(),
            detail,
        },
    );
}

#[tauri::command]
pub async fn hydrate_runtime_secrets(
    github_token: Option<String>,
    ai_keys: HashMap<String, String>,
) -> Result<()> {
    {
        let mut slot = github_token_store()
            .lock()
            .expect("github token store poisoned");
        *slot = github_token
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty());
    }
    {
        let mut map = ai_key_store().lock().expect("ai key store poisoned");
        map.clear();
        for (provider, key) in ai_keys {
            if normalize_provider(&provider).is_err() {
                continue;
            }
            let trimmed = key.trim().to_string();
            if !trimmed.is_empty() {
                map.insert(provider, trimmed);
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_token(token: String) -> Result<()> {
    let trimmed = token.trim().to_string();
    if trimmed.is_empty() {
        return Err(Error::NoToken);
    }
    *github_token_store()
        .lock()
        .expect("github token store poisoned") = Some(trimmed);
    Ok(())
}

#[tauri::command]
pub fn has_token() -> bool {
    load_token().is_ok()
}

#[tauri::command]
pub fn delete_token() -> Result<()> {
    *github_token_store()
        .lock()
        .expect("github token store poisoned") = None;
    Ok(())
}

#[tauri::command]
pub async fn save_cursor_key(key: String) -> Result<()> {
    save_ai_key("cursor".into(), key).await
}

#[tauri::command]
pub fn has_cursor_key() -> bool {
    has_ai_key("cursor".into())
}

#[tauri::command]
pub fn delete_cursor_key() -> Result<()> {
    delete_ai_key("cursor".into())
}

#[tauri::command]
pub async fn validate_cursor_key(key: Option<String>) -> Result<serde_json::Value> {
    validate_ai_key("cursor".into(), key).await
}

#[tauri::command]
pub async fn save_ai_key(provider: String, key: String) -> Result<()> {
    normalize_provider(&provider)?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err(Error::NoAiKey {
            provider: provider.clone(),
        });
    }
    ai_key_store()
        .lock()
        .expect("ai key store poisoned")
        .insert(provider, trimmed);
    Ok(())
}

#[tauri::command]
pub fn has_ai_key(provider: String) -> bool {
    load_ai_key(&provider).is_ok()
}

#[tauri::command]
pub fn delete_ai_key(provider: String) -> Result<()> {
    normalize_provider(&provider)?;
    ai_key_store()
        .lock()
        .expect("ai key store poisoned")
        .remove(&provider);
    Ok(())
}

#[derive(Serialize)]
pub struct AiProviderStatus {
    id: String,
    has_key: bool,
}

#[tauri::command]
pub fn list_ai_provider_status() -> Vec<AiProviderStatus> {
    known_ai_providers()
        .iter()
        .map(|id| AiProviderStatus {
            id: (*id).to_string(),
            has_key: load_ai_key(id).is_ok(),
        })
        .collect()
}

#[tauri::command]
pub async fn validate_ai_key(
    provider: String,
    key: Option<String>,
) -> Result<serde_json::Value> {
    let key = match key {
        Some(k) if !k.trim().is_empty() => k,
        Some(_) | None => load_ai_key(&provider)?,
    };
    match provider.as_str() {
        "cursor" => cursor_get(&key, "/me").await,
        "openai" | "codex" => openai_validate(&key).await,
        "anthropic" => anthropic_validate(&key).await,
        "gemini" => gemini_validate(&key).await,
        other => Err(Error::UnknownAiProvider(other.to_string())),
    }
}

#[tauri::command]
pub async fn validate_token(token: Option<String>) -> Result<GithubUser> {
    let token = match token {
        Some(t) => t,
        None => load_token()?,
    };
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/user")
        .header("User-Agent", UA)
        .header("Accept", "application/vnd.github+json")
        .bearer_auth(&token)
        .send()
        .await?;

    let status = resp.status();
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(Error::Github {
            status: status.as_u16(),
            message,
        });
    }

    #[derive(serde::Deserialize)]
    struct Raw {
        login: String,
        name: Option<String>,
        avatar_url: String,
    }
    let raw: Raw = resp.json().await?;
    Ok(GithubUser {
        login: raw.login,
        name: raw.name,
        avatar_url: raw.avatar_url,
    })
}

fn resolve_url(path: &str) -> String {
    if path.starts_with("http") {
        path.to_string()
    } else {
        format!("https://api.github.com{path}")
    }
}

#[tauri::command]
pub async fn github_get(path: String) -> Result<serde_json::Value> {
    github_request("GET".into(), path, None).await
}

#[tauri::command]
pub async fn github_request(
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value> {
    let token = load_token()?;
    let url = resolve_url(&path);
    let client = reqwest::Client::new();
    let method = method
        .parse::<reqwest::Method>()
        .map_err(|e| Error::Github {
            status: 400,
            message: format!("invalid method: {e}"),
        })?;

    let mut req = client
        .request(method, &url)
        .header("User-Agent", UA)
        .header("Accept", "application/vnd.github+json")
        .bearer_auth(&token);

    if let Some(body) = body {
        req = req
            .header("Content-Type", "application/json")
            .json(&body);
    }

    let resp = req.send().await?;
    let status = resp.status();
    if status.as_u16() == 204 {
        return Ok(serde_json::Value::Null);
    }
    if !status.is_success() {
        let message = resp.text().await.unwrap_or_default();
        return Err(Error::Github {
            status: status.as_u16(),
            message,
        });
    }
    let text = resp.text().await?;
    if text.is_empty() {
        return Ok(serde_json::Value::Null);
    }
    Ok(serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text)))
}

async fn cursor_get(key: &str, path: &str) -> Result<serde_json::Value> {
    let resp = reqwest::Client::new()
        .get(format!("{CURSOR_API}{path}"))
        .header("User-Agent", UA)
        .basic_auth(key, Some(""))
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Cursor {
            status: status.as_u16(),
            message: text,
        });
    }
    Ok(serde_json::from_str(&text).unwrap_or(serde_json::Value::String(text)))
}

async fn openai_validate(key: &str) -> Result<serde_json::Value> {
    let resp = reqwest::Client::new()
        .get(format!("{OPENAI_API}/models"))
        .header("User-Agent", UA)
        .bearer_auth(key)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: "openai".into(),
            status: status.as_u16(),
            message: text,
        });
    }
    Ok(json!({ "ok": true }))
}

async fn anthropic_validate(key: &str) -> Result<serde_json::Value> {
    // Lightweight authenticated call — list models if available, else tiny messages probe avoided.
    let resp = reqwest::Client::new()
        .get(format!("{ANTHROPIC_API}/models"))
        .header("User-Agent", UA)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: "anthropic".into(),
            status: status.as_u16(),
            message: text,
        });
    }
    Ok(json!({ "ok": true }))
}

async fn gemini_validate(key: &str) -> Result<serde_json::Value> {
    let url = format!("{GEMINI_API}/models?key={key}");
    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", UA)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: "gemini".into(),
            status: status.as_u16(),
            message: text,
        });
    }
    Ok(json!({ "ok": true }))
}

fn strip_code_fence(text: &str) -> String {
    let trimmed = text.trim();
    if let Some(rest) = trimmed.strip_prefix("```json") {
        return rest
            .trim()
            .trim_end_matches("```")
            .trim()
            .to_string();
    }
    if let Some(rest) = trimmed.strip_prefix("```") {
        return rest
            .trim()
            .trim_end_matches("```")
            .trim()
            .to_string();
    }
    trimmed.to_string()
}

async fn openai_chat(provider: &str, key: &str, model: &str, prompt: &str) -> Result<String> {
    let body = json!({
        "model": model,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": "You are a senior engineer reviewing GitHub PR patches. Reply with ONLY a JSON object."
            },
            { "role": "user", "content": prompt }
        ]
    });
    let resp = reqwest::Client::new()
        .post(format!("{OPENAI_API}/chat/completions"))
        .header("User-Agent", UA)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: provider.into(),
            status: status.as_u16(),
            message: text,
        });
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if content.trim().is_empty() {
        return Err(Error::AiProvider {
            provider: provider.into(),
            status: 500,
            message: "empty model response".into(),
        });
    }
    Ok(strip_code_fence(&content))
}

async fn anthropic_chat(key: &str, prompt: &str) -> Result<String> {
    let body = json!({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4096,
        "temperature": 0.2,
        "messages": [{ "role": "user", "content": prompt }]
    });
    let resp = reqwest::Client::new()
        .post(format!("{ANTHROPIC_API}/messages"))
        .header("User-Agent", UA)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: "anthropic".into(),
            status: status.as_u16(),
            message: text,
        });
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
    let content = parsed
        .pointer("/content/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if content.trim().is_empty() {
        return Err(Error::AiProvider {
            provider: "anthropic".into(),
            status: 500,
            message: "empty model response".into(),
        });
    }
    Ok(strip_code_fence(&content))
}

async fn gemini_chat(key: &str, prompt: &str) -> Result<String> {
    let url = format!("{GEMINI_API}/models/gemini-2.0-flash:generateContent?key={key}");
    let body = json!({
        "contents": [{
            "role": "user",
            "parts": [{ "text": prompt }]
        }],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    });
    let resp = reqwest::Client::new()
        .post(&url)
        .header("User-Agent", UA)
        .json(&body)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::AiProvider {
            provider: "gemini".into(),
            status: status.as_u16(),
            message: text,
        });
    }
    let parsed: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);
    let content = parsed
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if content.trim().is_empty() {
        return Err(Error::AiProvider {
            provider: "gemini".into(),
            status: 500,
            message: "empty model response".into(),
        });
    }
    Ok(strip_code_fence(&content))
}

async fn run_provider_prompt(
    app: &AppHandle,
    provider: &str,
    prompt: &str,
    running_label: &str,
    finished_label: &str,
) -> Result<String> {
    let key = load_ai_key(provider)?;
    emit_progress(app, "running", running_label, Some(provider.to_string()));
    let text = match provider {
        "cursor" => {
            return run_local_cursor_prompt(app, &key, prompt, running_label, finished_label)
                .await;
        }
        "openai" => openai_chat(provider, &key, "gpt-4.1-mini", prompt).await?,
        "codex" => openai_chat(provider, &key, "gpt-4.1", prompt).await?,
        "anthropic" => anthropic_chat(&key, prompt).await?,
        "gemini" => gemini_chat(&key, prompt).await?,
        other => return Err(Error::UnknownAiProvider(other.to_string())),
    };
    emit_progress(app, "finished", finished_label, None);
    Ok(text)
}

/// JSON schema + chat-style rules shared by review + refine (patch text only, no clone).
fn review_json_schema_rules() -> &'static str {
    r#"Reply with ONLY a single JSON object (no markdown fences, no prose outside JSON):
{
  "summary": "1-3 sentence overall assessment",
  "suggestedEvent": "COMMENT" | "REQUEST_CHANGES" | "APPROVE",
  "findings": [
    {
      "severity": "info" | "warning" | "critical",
      "title": "short title",
      "body": "concrete feedback about the code change",
      "path": "optional/file/path",
      "line": 123
    }
  ]
}"#
}

fn patch_only_chat_rules() -> &'static str {
    r#"You are a senior engineer doing a chat-style PR review of pasted unified diffs
(same as when a human pastes a GitHub PR diff into Cursor chat).

CRITICAL — patch-only mode (intentional, not a failure):
- The diff text in this prompt IS the full review input. Treat it as sufficient.
- Your workspace / disk may be empty. That is expected. Do NOT try to clone, fetch,
  or open the GitHub repo. Do NOT use shell/git/file tools for this task.
- NEVER apologize about missing clone, empty workspace, private GitHub API, or
  inability to access files. Never make a finding about the environment.
- Review the code changes in the patches: bugs, regressions, missing tests,
  risky logic, API/contract breaks, unclear naming, security issues.
- Prefer actionable findings tied to real paths and line numbers from the patches
  (use the new-file line numbers from the unified diff). If the change
  looks solid, return a short summary, few info findings, and APPROVE or COMMENT.
- Do NOT edit files, push commits, open PRs, or post to GitHub."#
}

fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".."))
}

fn local_prompt_script() -> PathBuf {
    project_root().join("scripts/cursor-local-prompt.mjs")
}

fn candidate_node_bins() -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            let p = Path::new(dir).join("node");
            if p.is_file() {
                out.push(p);
            }
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let nvm = PathBuf::from(&home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(&nvm) {
            let mut versions: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            versions.sort_by_key(|e| e.file_name());
            versions.reverse();
            for e in versions {
                let p = e.path().join("bin/node");
                if p.is_file() {
                    out.push(p);
                }
            }
        }
        out.push(PathBuf::from(home).join(".local/bin/node"));
    }
    out.push(PathBuf::from("/opt/homebrew/bin/node"));
    out.push(PathBuf::from("/usr/local/bin/node"));
    out.push(PathBuf::from("/usr/bin/node"));
    out
}

fn resolve_node_bin() -> Result<PathBuf> {
    for p in candidate_node_bins() {
        if p.is_file() {
            return Ok(p);
        }
    }
    Err(Error::Cursor {
        status: 500,
        message: "node binary not found — install Node.js or ensure it is on PATH".into(),
    })
}

/// Run local `@cursor/sdk` Agent.prompt via scripts/cursor-local-prompt.mjs.
async fn run_local_cursor_prompt(
    app: &AppHandle,
    api_key: &str,
    prompt: &str,
    waiting_label: &str,
    finished_label: &str,
) -> Result<String> {
    let script = local_prompt_script();
    if !script.is_file() {
        return Err(Error::Cursor {
            status: 500,
            message: format!("missing local Cursor script at {}", script.display()),
        });
    }
    let node = resolve_node_bin()?;
    let root = project_root();

    emit_progress(
        app,
        "start_agent",
        "Starting local Cursor SDK (fast, no cloud VM)",
        Some(format!("node {}", script.display())),
    );

    let payload = json!({
        "apiKey": api_key,
        "prompt": prompt,
        "modelId": "composer-2.5",
        "fast": true
    });

    let mut child = Command::new(&node)
        .arg(&script)
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| Error::Cursor {
            status: 500,
            message: format!("failed to spawn local Cursor SDK: {e}"),
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(payload.to_string().as_bytes())
            .await
            .map_err(|e| Error::Cursor {
                status: 500,
                message: format!("failed writing prompt to local Cursor SDK: {e}"),
            })?;
        drop(stdin);
    }

    emit_progress(app, "waiting", waiting_label, Some("local agent".into()));

    let app_heartbeat = app.clone();
    let label = waiting_label.to_string();
    let heartbeat = tokio::spawn(async move {
        let mut n = 0u32;
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(3)).await;
            n += 1;
            emit_progress(
                &app_heartbeat,
                "waiting",
                &format!("{label}…"),
                Some(format!("local tick {n}")),
            );
        }
    });

    let output = child.wait_with_output().await.map_err(|e| Error::Cursor {
        status: 500,
        message: format!("local Cursor SDK process error: {e}"),
    })?;
    heartbeat.abort();

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let parsed: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(_) => {
            return Err(Error::Cursor {
                status: 500,
                message: format!(
                    "local Cursor SDK returned non-JSON (exit {:?}): stdout={stdout} stderr={stderr}",
                    output.status.code()
                ),
            });
        }
    };

    if parsed.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = parsed
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("local Cursor SDK failed");
        return Err(Error::Cursor {
            status: 500,
            message: if stderr.is_empty() {
                err.to_string()
            } else {
                format!("{err} | stderr: {stderr}")
            },
        });
    }

    let text = parsed
        .get("result")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    emit_progress(app, "finished", finished_label, None);
    Ok(text)
}

/// Review PR from GitHub patch text only (no repo clone). Does NOT post to GitHub.
#[tauri::command]
pub async fn ai_review_pr(
    app: AppHandle,
    provider: String,
    pr_title: String,
    pr_number: u64,
    pr_url: String,
    patch_context: String,
) -> Result<String> {
    if patch_context.trim().is_empty() {
        return Err(Error::AiProvider {
            provider: provider.clone(),
            status: 400,
            message: "no PR patch content from GitHub to review".into(),
        });
    }

    emit_progress(
        &app,
        "prepare",
        "Building chat-style review prompt from GitHub diffs",
        Some(format!("{} chars of patch context", patch_context.len())),
    );

    let schema = review_json_schema_rules();
    let rules = patch_only_chat_rules();
    let prompt = format!(
        r#"{rules}

PR #{pr_number}: "{pr_title}"
URL (metadata only — do not fetch): {pr_url}

{schema}

===== BEGIN GITHUB PR PATCHES (review these) =====
{patch_context}
===== END GITHUB PR PATCHES =====
"#
    );

    run_provider_prompt(
        &app,
        &provider,
        &prompt,
        &format!("{provider} reviewing pasted patches"),
        "AI draft ready — not posted to GitHub yet",
    )
    .await
}

/// Rewrite an existing draft JSON with a user instruction. Does NOT post to GitHub.
#[tauri::command]
pub async fn ai_refine_review(
    app: AppHandle,
    provider: String,
    current_draft_json: String,
    instruction: String,
) -> Result<String> {
    let instruction = instruction.trim().to_string();
    if instruction.is_empty() {
        return Err(Error::AiProvider {
            provider: provider.clone(),
            status: 400,
            message: "refine instruction is empty".into(),
        });
    }

    emit_progress(
        &app,
        "prepare",
        "Refining AI draft with your instruction",
        Some(instruction.clone()),
    );

    let schema = review_json_schema_rules();
    let prompt = format!(
        r#"You are editing an existing GitHub PR review draft in a chat.
Do NOT mention workspace/clone/environment. Rewrite the draft only.
Do NOT use shell/git/file tools — reply with JSON only.

CURRENT DRAFT JSON:
{current_draft_json}

USER INSTRUCTION:
{instruction}

{schema}

- Apply the user instruction carefully (e.g. fewer findings, English only, simpler wording).
- Keep technical accuracy. Do not invent unrelated issues.
- Do NOT edit repository files, push commits, or post to GitHub.
"#
    );

    run_provider_prompt(
        &app,
        &provider,
        &prompt,
        &format!("{provider} refining draft"),
        "Refined draft ready — still not posted to GitHub",
    )
    .await
}

/// Backward-compatible Cursor-only entrypoint.
#[tauri::command]
pub async fn cursor_review_pr(
    app: AppHandle,
    pr_title: String,
    pr_number: u64,
    pr_url: String,
    patch_context: String,
) -> Result<String> {
    ai_review_pr(
        app,
        "cursor".into(),
        pr_title,
        pr_number,
        pr_url,
        patch_context,
    )
    .await
}

/// Backward-compatible Cursor-only refine entrypoint.
#[tauri::command]
pub async fn cursor_refine_review(
    app: AppHandle,
    current_draft_json: String,
    instruction: String,
) -> Result<String> {
    ai_refine_review(app, "cursor".into(), current_draft_json, instruction).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_providers_include_cursor_and_openai() {
        assert!(known_ai_providers().contains(&"cursor"));
        assert!(known_ai_providers().contains(&"openai"));
        assert!(known_ai_providers().contains(&"anthropic"));
        assert!(known_ai_providers().contains(&"gemini"));
        assert!(known_ai_providers().contains(&"codex"));
    }

    #[test]
    fn normalize_provider_accepts_known() {
        assert!(normalize_provider("cursor").is_ok());
        assert!(normalize_provider("openai").is_ok());
    }

    #[test]
    fn normalize_provider_rejects_unknown() {
        let err = normalize_provider("nope").unwrap_err();
        assert!(matches!(err, Error::UnknownAiProvider(_)));
    }

    #[test]
    fn load_token_errors_when_empty() {
        *github_token_store().lock().unwrap() = None;
        assert!(matches!(load_token(), Err(Error::NoToken)));
    }

    #[test]
    fn hydrate_style_token_roundtrip() {
        *github_token_store().lock().unwrap() = Some("  ghp_test  ".into());
        // load_token does not trim — store should hold raw value set by commands
        let token = load_token().unwrap();
        assert_eq!(token, "  ghp_test  ");
        *github_token_store().lock().unwrap() = None;
    }
}
