// ── IPC Commands ──────────────────────────────────────────────────────────
// All Tauri invoke() handlers. This is the complete API surface exposed to React.
// State is passed via Tauri's managed state system.

use crate::agent::{AgentCompletedEvent, AgentManager};
use crate::db::{models::*, queries::*, DbPool};
use crate::fs::{self, FsEntry};
use crate::llm::{self, LlmSettings, ModelInfo};
use crate::terminal::TerminalManager;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

// ── App State ─────────────────────────────────────────────────────────────

pub struct AppState {
    pub db: DbPool,
    pub llm_settings: Arc<Mutex<LlmSettings>>,
    pub agent_manager: Arc<AgentManager>,
    pub terminal_manager: Arc<TerminalManager>,
    pub fs_watchers: Arc<Mutex<Vec<notify::RecommendedWatcher>>>,
}

// ── Workspace Commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn workspace_list_cmd(state: State<AppState>) -> Result<Vec<Workspace>, String> {
    workspace_list(&state.db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn workspace_create_cmd(
    state: State<AppState>,
    name: String,
    path: String,
) -> Result<Workspace, String> {
    let ws = Workspace::new(name, path);
    workspace_create(&state.db, &ws).map_err(|e| e.to_string())?;
    Ok(ws)
}

#[tauri::command]
pub fn workspace_delete_cmd(state: State<AppState>, id: String) -> Result<(), String> {
    workspace_delete(&state.db, &id).map_err(|e| e.to_string())
}

// ── Project Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub fn project_list_cmd(state: State<AppState>, workspace_id: String) -> Result<Vec<Project>, String> {
    project_list(&state.db, &workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn project_create_cmd(
    state: State<AppState>,
    workspace_id: String,
    name: String,
) -> Result<Project, String> {
    let p = Project::new(workspace_id, name);
    project_create(&state.db, &p).map_err(|e| e.to_string())?;
    Ok(p)
}

#[tauri::command]
pub fn project_delete_cmd(state: State<AppState>, id: String) -> Result<(), String> {
    project_delete(&state.db, &id).map_err(|e| e.to_string())
}

// ── Note Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn note_list_cmd(
    state: State<AppState>,
    workspace_id: String,
    project_id: Option<String>,
) -> Result<Vec<Note>, String> {
    note_list(&state.db, &workspace_id, project_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn note_get_cmd(state: State<AppState>, id: String) -> Result<Option<Note>, String> {
    note_get(&state.db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn note_create_cmd(
    state: State<AppState>,
    workspace_id: String,
    project_id: String,
    title: String,
) -> Result<Note, String> {
    let n = Note::new(workspace_id, project_id, title);
    note_create(&state.db, &n).map_err(|e| e.to_string())?;
    Ok(n)
}

#[tauri::command]
pub fn note_update_cmd(state: State<AppState>, note: Note) -> Result<Note, String> {
    note_update(&state.db, &note).map_err(|e| e.to_string())?;
    Ok(note)
}

#[tauri::command]
pub fn note_delete_cmd(state: State<AppState>, id: String) -> Result<(), String> {
    note_delete(&state.db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn note_search_cmd(
    state: State<AppState>,
    workspace_id: String,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    note_search_fts(&state.db, &workspace_id, &query).map_err(|e| e.to_string())
}

// ── Chat Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn chat_session_list_cmd(
    state: State<AppState>,
    workspace_id: String,
) -> Result<Vec<ChatSession>, String> {
    chat_session_list(&state.db, &workspace_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_session_create_cmd(
    state: State<AppState>,
    workspace_id: String,
    project_id: String,
) -> Result<ChatSession, String> {
    let s = ChatSession::new(workspace_id, project_id);
    chat_session_create(&state.db, &s).map_err(|e| e.to_string())?;
    Ok(s)
}

#[tauri::command]
pub fn chat_session_delete_cmd(state: State<AppState>, id: String) -> Result<(), String> {
    chat_session_delete(&state.db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_messages_list_cmd(
    state: State<AppState>,
    session_id: String,
) -> Result<Vec<ChatMessage>, String> {
    chat_messages_list(&state.db, &session_id).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize)]
pub struct ChatSendParams {
    pub session_id: String,
    pub content: String,
    pub workspace_context: Option<String>,
}

/// Send a user message and kick off streaming LLM response.
/// The assistant's response streams as `llm:chunk` events.
#[tauri::command]
pub async fn chat_send_cmd(
    app: AppHandle,
    state: State<'_, AppState>,
    params: ChatSendParams,
) -> Result<(), String> {
    // Save user message
    let user_msg = ChatMessage::new(&params.session_id, "user", &params.content);
    chat_message_insert(&state.db, &user_msg).map_err(|e| e.to_string())?;

    // Build messages for LLM
    let history = chat_messages_list(&state.db, &params.session_id)
        .unwrap_or_default()
        .into_iter()
        .map(|m| llm::LlmMessage { role: m.role, content: m.content })
        .collect::<Vec<_>>();

    let settings = state.llm_settings.lock().unwrap().clone();
    let db = state.db.clone();

    let req = llm::LlmRequest {
        messages: history,
        temperature: Some(0.4),
        max_tokens: Some(2000),
        json_mode: false,
        model: None,
        session_id: params.session_id.clone(),
    };

    tokio::spawn(async move {
        match llm::complete_streaming(app.clone(), req, &settings).await {
            Ok(full) => {
                // Save assistant message
                let asst_msg = ChatMessage::new(&params.session_id, "assistant", &full);
                let _ = chat_message_insert(&db, &asst_msg);
            }
            Err(e) => {
                tracing::error!("LLM error: {}", e);
            }
        }
    });

    Ok(())
}

// ── LLM Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn llm_models_cmd(state: State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    let settings = state.llm_settings.lock().unwrap().clone();
    llm::list_models(&settings).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn llm_complete_cmd(
    state: State<'_, AppState>,
    messages: Vec<llm::LlmMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    json_mode: bool,
) -> Result<String, String> {
    let settings = state.llm_settings.lock().unwrap().clone();
    let req = llm::LlmRequest {
        messages,
        temperature,
        max_tokens,
        json_mode,
        model: None,
        session_id: "one_off".into(),
    };
    llm::complete(req, &settings).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn llm_complete_streaming_cmd(
    app: AppHandle,
    state: State<'_, AppState>,
    messages: Vec<llm::LlmMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
    json_mode: bool,
    session_id: String,
) -> Result<(), String> {
    let settings = state.llm_settings.lock().unwrap().clone();
    let req = llm::LlmRequest {
        messages,
        temperature,
        max_tokens,
        json_mode,
        model: None,
        session_id,
    };
    tokio::spawn(async move {
        let _ = llm::complete_streaming(app, req, &settings).await;
    });
    Ok(())
}

#[tauri::command]
pub fn llm_settings_get_cmd(state: State<AppState>) -> LlmSettings {
    state.llm_settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn llm_settings_set_cmd(state: State<AppState>, settings: LlmSettings) -> Result<(), String> {
    let json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    config_set(&state.db, "llm_settings", &json).map_err(|e| e.to_string())?;
    *state.llm_settings.lock().unwrap() = settings;
    Ok(())
}

// ── File System Commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn fs_read_cmd(path: String) -> Result<String, String> {
    fs::read_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_write_cmd(path: String, content: String) -> Result<(), String> {
    fs::write_file(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_list_cmd(path: String) -> Result<Vec<FsEntry>, String> {
    fs::list_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_delete_cmd(path: String) -> Result<(), String> {
    fs::delete_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_watch_cmd(app: AppHandle, state: State<AppState>, path: String) -> Result<(), String> {
    let watcher = fs::start_watch(app, &path).map_err(|e| e.to_string())?;
    state.fs_watchers.lock().unwrap().push(watcher);
    Ok(())
}

// ── Terminal Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn terminal_spawn_cmd(
    app: AppHandle,
    state: State<AppState>,
    shell: Option<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    state.terminal_manager
        .spawn(app, shell.as_deref(), cwd.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_write_cmd(
    state: State<AppState>,
    id: String,
    data: String,
) -> Result<(), String> {
    state.terminal_manager.write(&id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_resize_cmd(
    state: State<AppState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.terminal_manager.resize(&id, cols, rows).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn terminal_kill_cmd(state: State<AppState>, id: String) {
    state.terminal_manager.kill(&id);
}

// ── Agent Commands ────────────────────────────────────────────────────────

#[tauri::command]
pub fn agent_start_cmd(
    app: AppHandle,
    state: State<AppState>,
    goal: String,
    workspace_path: String,
) -> String {
    let settings = state.llm_settings.lock().unwrap().clone();
    state.agent_manager.start(app, goal, workspace_path, state.db.clone(), settings)
}

#[tauri::command]
pub fn agent_stop_cmd(state: State<AppState>, run_id: String) {
    state.agent_manager.stop(&run_id);
}

#[tauri::command]
pub fn agent_approve_cmd(state: State<AppState>, action_id: String) {
    state.agent_manager.approve(&action_id);
}

// ── Config Commands ───────────────────────────────────────────────────────

#[tauri::command]
pub fn config_get_cmd(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    config_get(&state.db, &key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn config_set_cmd(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    config_set(&state.db, &key, &value).map_err(|e| e.to_string())
}
