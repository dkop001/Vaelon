// ── Database Models ────────────────────────────────────────────────────────
// Rust structs mirroring every DB table. Serde for JSON IPC.

use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}

// ── Workspace ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

impl Workspace {
    pub fn new(name: impl Into<String>, path: impl Into<String>) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            name: name.into(),
            path: path.into(),
            description: String::new(),
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

// ── Project ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: String,
    pub color: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Project {
    pub fn new(workspace_id: impl Into<String>, name: impl Into<String>) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            name: name.into(),
            description: String::new(),
            color: "#6366f1".into(),
            archived: false,
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

// ── Note ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub summary: String,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl Note {
    pub fn new(workspace_id: impl Into<String>, project_id: impl Into<String>, title: impl Into<String>) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            project_id: project_id.into(),
            title: title.into(),
            content: String::new(),
            tags: vec![],
            summary: String::new(),
            pinned: false,
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

// ── Task ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Pending,
    InProgress,
    Done,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub note_id: Option<String>,
    pub title: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ── Chat ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
}

impl ChatSession {
    pub fn new(workspace_id: impl Into<String>, project_id: impl Into<String>) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            project_id: project_id.into(),
            title: "New Chat".into(),
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub metadata: serde_json::Value,
    pub created_at: String,
}

impl ChatMessage {
    pub fn new(session_id: impl Into<String>, role: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: new_id(),
            session_id: session_id.into(),
            role: role.into(),
            content: content.into(),
            metadata: serde_json::Value::Object(Default::default()),
            created_at: now_str(),
        }
    }
}

// ── Build Log ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildLog {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub goal: String,
    pub steps_json: serde_json::Value,
    pub outcome: String,
    pub notes: String,
    pub created_at: String,
}

// ── Search Result ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub note_id: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
    pub updated_at: String,
}

// ── App Config ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
