#[cfg(target_os = "macos")]
use tauri::Manager;

/// Prefer bundled Resources/icon.icns, then source-tree icons for `tauri:dev`.
#[cfg(target_os = "macos")]
pub(crate) fn resolve_notification_icon(
    resource_dir: Option<&std::path::Path>,
) -> Option<std::path::PathBuf> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Some(dir) = resource_dir {
        candidates.push(dir.join("icon.icns"));
        candidates.push(dir.join("icons").join("icon.icns"));
        candidates.push(dir.join("icon.png"));
        candidates.push(dir.join("icons").join("128x128.png"));
    }
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidates.push(manifest.join("icons").join("icon.icns"));
    candidates.push(manifest.join("icons").join("icon.png"));
    candidates.push(manifest.join("icons").join("128x128.png"));

    candidates.into_iter().find(|p| p.is_file())
}

/// Send a macOS notification with the IM Review app icon.
/// Returns `false` on other platforms (or when no icon is found) so the
/// frontend can fall back to the Tauri notification plugin.
#[tauri::command]
pub async fn send_app_notification(
    app: tauri::AppHandle,
    title: String,
    body: Option<String>,
) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let resource_dir = app.path().resource_dir().ok();
        let Some(icon) = resolve_notification_icon(resource_dir.as_deref()) else {
            return Ok(false);
        };
        let icon = icon.to_string_lossy().into_owned();
        let identifier = app.config().identifier.clone();
        let message = body.unwrap_or_default();

        tauri::async_runtime::spawn_blocking(move || {
            // Prefer our bundle id so Notification Center doesn't bind to Terminal
            // (tauri-plugin-notification forces Terminal in `tauri:dev`).
            let _ = mac_notification_sys::set_application(&identifier);
            let mut notification = mac_notification_sys::Notification::new();
            notification
                .title(&title)
                .message(&message)
                .app_icon(&icon)
                .asynchronous(true);
            notification
                .send()
                .map(|_| true)
                .map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, title, body);
        Ok(false)
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::resolve_notification_icon;

    #[test]
    fn finds_source_tree_icon_for_dev() {
        let icon = resolve_notification_icon(None);
        assert!(
            icon.is_some(),
            "expected icons/icon.icns (or png) under src-tauri"
        );
        let path = icon.unwrap();
        assert!(path.ends_with("icon.icns") || path.ends_with("icon.png") || path.ends_with("128x128.png"));
    }

    #[test]
    fn prefers_bundled_resource_icon() {
        let dir = tempfile::tempdir().unwrap();
        let bundled = dir.path().join("icon.icns");
        std::fs::write(&bundled, b"fake").unwrap();
        assert_eq!(
            resolve_notification_icon(Some(dir.path())),
            Some(bundled)
        );
    }
}
