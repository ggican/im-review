mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
