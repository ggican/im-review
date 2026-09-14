use crate::commands::{Error, Result, UA};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::time::{sleep, timeout};

const GOOGLE_AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO: &str = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_API: &str = "https://www.googleapis.com";
const GOOGLE_EVENTS: &str = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES: &str = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";
const REDIRECT_PORT: u16 = 17320;
const OAUTH_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Clone)]
struct GoogleCreds {
    client_id: String,
    client_secret: String,
    access_token: String,
    refresh_token: String,
    expiry: i64,
    #[allow(dead_code)]
    email: String,
    #[allow(dead_code)]
    name: String,
}

fn google_store() -> &'static Mutex<Option<GoogleCreds>> {
    static STORE: OnceLock<Mutex<Option<GoogleCreds>>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(None))
}

/// In-flight local OAuth callback listener (port 17320). Cancel frees the port
/// when the user closes the browser / starts Connect again.
struct OauthSession {
    generation: u64,
    cancel: Option<oneshot::Sender<()>>,
}

fn oauth_session() -> &'static Mutex<OauthSession> {
    static SLOT: OnceLock<Mutex<OauthSession>> = OnceLock::new();
    SLOT.get_or_init(|| {
        Mutex::new(OauthSession {
            generation: 0,
            cancel: None,
        })
    })
}

fn begin_oauth_session() -> (u64, oneshot::Receiver<()>) {
    let (tx, rx) = oneshot::channel();
    let mut slot = oauth_session().lock().expect("oauth session poisoned");
    if let Some(prev) = slot.cancel.take() {
        let _ = prev.send(());
    }
    slot.generation = slot.generation.wrapping_add(1);
    let generation = slot.generation;
    slot.cancel = Some(tx);
    (generation, rx)
}

fn end_oauth_session(generation: u64) {
    let mut slot = oauth_session().lock().expect("oauth session poisoned");
    if slot.generation == generation {
        slot.cancel = None;
    }
}

fn request_oauth_cancel() -> bool {
    let mut slot = oauth_session().lock().expect("oauth session poisoned");
    if let Some(tx) = slot.cancel.take() {
        let _ = tx.send(());
        true
    } else {
        false
    }
}

#[tauri::command]
pub async fn google_oauth_cancel() -> Result<()> {
    if request_oauth_cancel() {
        // Give the previous accept loop a moment to drop the listener.
        sleep(Duration::from_millis(150)).await;
    }
    Ok(())
}

async fn bind_oauth_listener() -> Result<TcpListener> {
    let mut last_err = String::new();
    for _ in 0..8 {
        match TcpListener::bind(("127.0.0.1", REDIRECT_PORT)).await {
            Ok(listener) => return Ok(listener),
            Err(e) => {
                last_err = e.to_string();
                sleep(Duration::from_millis(100)).await;
            }
        }
    }
    Err(Error::GoogleOauth(format!(
        "Could not bind http://127.0.0.1:{REDIRECT_PORT} ({last_err}). Click Cancel Google sign-in, wait a moment, then try Connect again."
    )))
}

pub fn hydrate(
    client_id: Option<String>,
    client_secret: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    expiry: Option<i64>,
    email: Option<String>,
    name: Option<String>,
) {
    let client_id = client_id.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let access_token = access_token.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let refresh_token = refresh_token.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    });
    let mut slot = google_store().lock().expect("google store poisoned");
    *slot = match (client_id, refresh_token) {
        (Some(client_id), Some(refresh_token)) => Some(GoogleCreds {
            client_id,
            client_secret: client_secret.unwrap_or_default().trim().to_string(),
            access_token: access_token.unwrap_or_default(),
            refresh_token,
            expiry: expiry.unwrap_or(0),
            email: email.unwrap_or_default(),
            name: name.unwrap_or_default(),
        }),
        _ => None,
    };
}

fn load_google() -> Result<GoogleCreds> {
    google_store()
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .filter(|c| !c.access_token.is_empty() || !c.refresh_token.is_empty())
        .ok_or(Error::NoGoogle)
}

fn save_google(creds: GoogleCreds) {
    *google_store().lock().expect("google store poisoned") = Some(creds);
}

#[derive(Serialize)]
pub struct GoogleAccount {
    email: String,
    name: String,
    access_token: String,
    refresh_token: String,
    expiry: i64,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn random_urlsafe(n: usize) -> String {
    let mut bytes = vec![0u8; n];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn pkce_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn query_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let k = parts.next()?;
        let v = parts.next().unwrap_or("");
        if k == key {
            return Some(urlencoding::decode(v).ok()?.into_owned());
        }
    }
    None
}

async fn wait_for_oauth_code(
    listener: TcpListener,
    state: &str,
    mut cancel_rx: oneshot::Receiver<()>,
) -> Result<String> {
    let accept = timeout(OAUTH_TIMEOUT, listener.accept());
    tokio::pin!(accept);
    let (mut socket, _) = tokio::select! {
        biased;
        _ = &mut cancel_rx => {
            return Err(Error::GoogleOauth("Google sign-in cancelled".into()));
        }
        result = &mut accept => {
            result
                .map_err(|_| Error::GoogleOauth("Google sign-in timed out. You can try Connect again.".into()))?
                .map_err(|e| Error::GoogleOauth(e.to_string()))?
        }
    };
    let mut buf = vec![0u8; 4096];
    let n = socket
        .read(&mut buf)
        .await
        .map_err(|e| Error::GoogleOauth(e.to_string()))?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let first = req.lines().next().unwrap_or("");
    let path = first.split_whitespace().nth(1).unwrap_or("/");
    let query = path.splitn(2, '?').nth(1).unwrap_or("");
    let html = if query_param(query, "error").is_some() {
        "<!doctype html><html><body><p>Sign-in cancelled. You can close this tab.</p></body></html>"
    } else {
        "<!doctype html><html><body><p>IM Review is connected to Google (Calendar &amp; Gmail). You can close this tab.</p></body></html>"
    };
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    let _ = socket.write_all(resp.as_bytes()).await;
    if let Some(err) = query_param(query, "error") {
        return Err(Error::GoogleOauth(format!("Google sign-in failed: {err}")));
    }
    let returned_state = query_param(query, "state").unwrap_or_default();
    if returned_state != state {
        return Err(Error::GoogleOauth("OAuth state mismatch".into()));
    }
    query_param(query, "code").ok_or_else(|| Error::GoogleOauth("No authorization code".into()))
}

async fn exchange_token(form: &str) -> Result<Value> {
    let resp = reqwest::Client::new()
        .post(GOOGLE_TOKEN)
        .header("User-Agent", UA)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form.to_string())
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Google {
            status: status.as_u16(),
            message: text,
        });
    }
    serde_json::from_str(&text).map_err(|e| Error::GoogleOauth(e.to_string()))
}

fn token_form(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

async fn fetch_userinfo(access_token: &str) -> Result<(String, String)> {
    let resp = reqwest::Client::new()
        .get(GOOGLE_USERINFO)
        .header("User-Agent", UA)
        .bearer_auth(access_token)
        .send()
        .await?;
    let status = resp.status();
    let data: Value = resp.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(Error::Google {
            status: status.as_u16(),
            message: data.to_string(),
        });
    }
    let email = data
        .get("email")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&email)
        .to_string();
    Ok((email, name))
}

async fn refresh_if_needed(mut creds: GoogleCreds) -> Result<GoogleCreds> {
    if creds.expiry > now_secs() + 60 && !creds.access_token.is_empty() {
        return Ok(creds);
    }
    if creds.refresh_token.is_empty() {
        return Err(Error::NoGoogle);
    }
    let mut pairs = vec![
        ("client_id", creds.client_id.as_str()),
        ("refresh_token", creds.refresh_token.as_str()),
        ("grant_type", "refresh_token"),
    ];
    if !creds.client_secret.is_empty() {
        pairs.push(("client_secret", creds.client_secret.as_str()));
    }
    let form = token_form(&pairs);
    let data = exchange_token(&form).await?;
    creds.access_token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if let Some(exp) = data.get("expires_in").and_then(|v| v.as_i64()) {
        creds.expiry = now_secs() + exp;
    }
    save_google(creds.clone());
    Ok(creds)
}

#[tauri::command]
pub async fn google_oauth_connect(
    app: AppHandle,
    client_id: String,
    client_secret: Option<String>,
) -> Result<GoogleAccount> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err(Error::GoogleOauth("Google OAuth client ID is required".into()));
    }
    let client_secret = client_secret.unwrap_or_default().trim().to_string();
    // Cancel any previous wait so port 17320 can be rebound (e.g. user closed browser).
    let _ = google_oauth_cancel().await;
    let listener = bind_oauth_listener().await?;
    let (generation, cancel_rx) = begin_oauth_session();
    let redirect = format!("http://127.0.0.1:{REDIRECT_PORT}");
    let verifier = random_urlsafe(32);
    let challenge = pkce_challenge(&verifier);
    let state = random_urlsafe(16);
    let auth_url = format!(
        "{GOOGLE_AUTH}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256&state={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect),
        urlencoding::encode(SCOPES),
        urlencoding::encode(&challenge),
        urlencoding::encode(&state),
    );
    let _ = app.emit("google-oauth-url", auth_url.clone());
    // Best-effort browser open; UI also shows a copyable URL if this fails.
    let _ = app.opener().open_url(&auth_url, None::<&str>);
    let code = match wait_for_oauth_code(listener, &state, cancel_rx).await {
        Ok(code) => code,
        Err(err) => {
            end_oauth_session(generation);
            return Err(err);
        }
    };
    end_oauth_session(generation);
    let mut pairs = vec![
        ("client_id", client_id.as_str()),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect.as_str()),
    ];
    if !client_secret.is_empty() {
        pairs.push(("client_secret", client_secret.as_str()));
    }
    let data = exchange_token(&token_form(&pairs)).await?;
    let access_token = data
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let refresh_token = data
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if access_token.is_empty() {
        return Err(Error::GoogleOauth("Google did not return an access token".into()));
    }
    if refresh_token.is_empty() {
        return Err(Error::GoogleOauth(
            "Google did not return a refresh token. Use a Desktop OAuth client and allow offline access.".into(),
        ));
    }
    let expiry = data
        .get("expires_in")
        .and_then(|v| v.as_i64())
        .map(|s| now_secs() + s)
        .unwrap_or(now_secs() + 3600);
    let (email, name) = fetch_userinfo(&access_token).await?;
    let creds = GoogleCreds {
        client_id: client_id.clone(),
        client_secret,
        access_token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        expiry,
        email: email.clone(),
        name: name.clone(),
    };
    save_google(creds);
    Ok(GoogleAccount {
        email,
        name,
        access_token,
        refresh_token,
        expiry,
    })
}

fn google_api_url(url_or_path: &str) -> String {
    if url_or_path.starts_with("http://") || url_or_path.starts_with("https://") {
        url_or_path.to_string()
    } else {
        format!("{GOOGLE_API}/{}", url_or_path.trim_start_matches('/'))
    }
}

async fn google_api_request(
    method: &str,
    url_or_path: &str,
    body: Option<Value>,
) -> Result<Value> {
    let creds = refresh_if_needed(load_google()?).await?;
    let url = google_api_url(url_or_path);
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        other => {
            return Err(Error::GoogleOauth(format!(
                "Unsupported HTTP method: {other}"
            )));
        }
    };
    req = req.header("User-Agent", UA).bearer_auth(&creds.access_token);
    if let Some(payload) = body {
        req = req.header("Content-Type", "application/json").json(&payload);
    }
    let resp = req.send().await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Google {
            status: status.as_u16(),
            message: text,
        });
    }
    if text.trim().is_empty() {
        return Ok(Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| Error::GoogleOauth(e.to_string()))
}

#[tauri::command]
pub async fn google_api_request_command(
    method: String,
    url_or_path: String,
    body: Option<Value>,
) -> Result<Value> {
    google_api_request(&method, &url_or_path, body).await
}

#[tauri::command]
pub async fn gmail_list_messages(
    query: Option<String>,
    label_ids: Option<Vec<String>>,
    page_token: Option<String>,
    max_results: Option<u32>,
) -> Result<Value> {
    let max = max_results.unwrap_or(25).clamp(1, 50);
    let mut url = format!("gmail/v1/users/me/messages?maxResults={max}");
    if let Some(q) = query.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        url.push_str(&format!("&q={}", urlencoding::encode(q)));
    }
    if let Some(labels) = label_ids {
        for id in labels {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                url.push_str(&format!("&labelIds={}", urlencoding::encode(trimmed)));
            }
        }
    }
    if let Some(token) = page_token.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
        url.push_str(&format!("&pageToken={}", urlencoding::encode(token)));
    }
    google_api_request("GET", &url, None).await
}

#[tauri::command]
pub async fn gmail_get_message(
    id: String,
    format: Option<String>,
    metadata_headers: Option<Vec<String>>,
) -> Result<Value> {
    let id = id.trim();
    if id.is_empty() {
        return Err(Error::GoogleOauth("Message id is required".into()));
    }
    let fmt = format
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("full");
    let mut url = format!("gmail/v1/users/me/messages/{id}?format={}", urlencoding::encode(fmt));
    if let Some(headers) = metadata_headers {
        for header in headers {
            let trimmed = header.trim();
            if !trimmed.is_empty() {
                url.push_str(&format!(
                    "&metadataHeaders={}",
                    urlencoding::encode(trimmed)
                ));
            }
        }
    }
    google_api_request("GET", &url, None).await
}

#[tauri::command]
pub async fn gmail_modify_message(
    id: String,
    add_label_ids: Option<Vec<String>>,
    remove_label_ids: Option<Vec<String>>,
) -> Result<Value> {
    let id = id.trim();
    if id.is_empty() {
        return Err(Error::GoogleOauth("Message id is required".into()));
    }
    let body = json!({
        "addLabelIds": add_label_ids.unwrap_or_default(),
        "removeLabelIds": remove_label_ids.unwrap_or_default(),
    });
    google_api_request(
        "POST",
        &format!("gmail/v1/users/me/messages/{id}/modify"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn gmail_list_labels() -> Result<Value> {
    google_api_request("GET", "gmail/v1/users/me/labels", None).await
}

#[tauri::command]
pub async fn google_calendar_events() -> Result<Value> {
    let creds = refresh_if_needed(load_google()?).await?;
    let time_min = chrono_like_now();
    let time_max = chrono_like_plus_days(7);
    let url = format!(
        "{GOOGLE_EVENTS}?singleEvents=true&orderBy=startTime&maxResults=40&timeMin={}&timeMax={}",
        urlencoding::encode(&time_min),
        urlencoding::encode(&time_max),
    );
    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", UA)
        .bearer_auth(&creds.access_token)
        .send()
        .await?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Google {
            status: status.as_u16(),
            message: text,
        });
    }
    Ok(serde_json::from_str(&text).unwrap_or(json!({ "items": [] })))
}

fn chrono_like_now() -> String {
    format_rfc3339(now_secs())
}

fn chrono_like_plus_days(days: i64) -> String {
    format_rfc3339(now_secs() + days * 86400)
}

fn format_rfc3339(secs: i64) -> String {
    // UTC timestamp without extra deps.
    let days = secs.div_euclid(86400);
    let tod = secs.rem_euclid(86400);
    let (year, month, day) = civil_from_days(days);
    let hour = tod / 3600;
    let min = (tod % 3600) / 60;
    let sec = tod % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{min:02}:{sec:02}Z")
}

/// Howard Hinnant civil_from_days (Unix epoch days).
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc3339_unix_epoch() {
        assert_eq!(format_rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_rfc3339(86_401), "1970-01-02T00:00:01Z");
    }
}
