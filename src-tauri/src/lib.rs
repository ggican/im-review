mod commands;

use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::hydrate_runtime_secrets,
            commands::save_token,
            commands::has_token,
            commands::delete_token,
            commands::validate_token,
            commands::save_cursor_key,
            commands::has_cursor_key,
            commands::delete_cursor_key,
            commands::validate_cursor_key,
            commands::save_ai_key,
            commands::has_ai_key,
            commands::delete_ai_key,
            commands::validate_ai_key,
            commands::list_ai_provider_status,
            commands::github_get,
            commands::github_request,
            commands::ai_review_pr,
            commands::ai_refine_review,
            commands::cursor_review_pr,
            commands::cursor_refine_review,
        ])
        .setup(|app| {
            // Red close button / window X → hide to tray (keep polling alive).
            // Quit only via tray menu "Quit" (or Cmd+Q app quit).
            if let Some(window) = app.get_webview_window("main") {
                let hide_target = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = hide_target.hide();
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // macOS: click Dock icon while hidden → show again.
            if let RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if !has_visible_windows {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
