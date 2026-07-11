// ── Vaelon — Rust Core lib.rs ─────────────────────────────────────────────
// Module declarations + Tauri app builder.

pub mod agent;
pub mod commands;
pub mod db;
pub mod fs;
pub mod llm;
pub mod terminal;

use commands::AppState;
use db::open;
use llm::LlmSettings;
use std::sync::{Arc, Mutex};
use agent::AgentManager;
use terminal::TerminalManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Initialize tracing ───────────────────────────────────────────────
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive(tracing::Level::INFO.into()))
        .init();

    tracing::info!("Vaelon starting...");

    // ── Open database ────────────────────────────────────────────────────
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Vaelon");
    std::fs::create_dir_all(&data_dir).expect("Could not create data directory");

    let db_path = data_dir.join("vaelon.db");
    let db = open(db_path.to_str().unwrap()).expect("Could not open database");

    // ── Load LLM settings ────────────────────────────────────────────────
    let llm_settings = if let Ok(Some(raw)) = db::queries::config_get(&db, "llm_settings") {
        serde_json::from_str::<LlmSettings>(&raw).unwrap_or_default()
    } else {
        LlmSettings::default()
    };

    let state = AppState {
        db,
        llm_settings: Arc::new(Mutex::new(llm_settings)),
        agent_manager: Arc::new(AgentManager::new()),
        terminal_manager: Arc::new(TerminalManager::new()),
        fs_watchers: Arc::new(Mutex::new(vec![])),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Workspace
            commands::workspace_list_cmd,
            commands::workspace_create_cmd,
            commands::workspace_delete_cmd,
            // Projects
            commands::project_list_cmd,
            commands::project_create_cmd,
            commands::project_delete_cmd,
            // Notes
            commands::note_list_cmd,
            commands::note_get_cmd,
            commands::note_create_cmd,
            commands::note_update_cmd,
            commands::note_delete_cmd,
            commands::note_search_cmd,
            // Chat
            commands::chat_session_list_cmd,
            commands::chat_session_create_cmd,
            commands::chat_session_delete_cmd,
            commands::chat_messages_list_cmd,
            commands::chat_send_cmd,
            // LLM
            commands::llm_models_cmd,
            commands::llm_complete_cmd,
            commands::llm_complete_streaming_cmd,
            commands::llm_settings_get_cmd,
            commands::llm_settings_set_cmd,
            // File System
            commands::fs_read_cmd,
            commands::fs_write_cmd,
            commands::fs_list_cmd,
            commands::fs_delete_cmd,
            commands::fs_watch_cmd,
            // Terminal
            commands::terminal_spawn_cmd,
            commands::terminal_write_cmd,
            commands::terminal_resize_cmd,
            commands::terminal_kill_cmd,
            // Agent
            commands::agent_start_cmd,
            commands::agent_stop_cmd,
            commands::agent_approve_cmd,
            // Config
            commands::config_get_cmd,
            commands::config_set_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vaelon");
}
