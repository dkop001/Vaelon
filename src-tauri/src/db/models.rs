// ── Database Models ────────────────────────────────────────────────────────
// Rust structs mirroring every DB table. Serde for JSON IPC.

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
    pub path: String,
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
            path: String::new(),
            archived: false,
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

// ── Project Meta (Identity) ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub project_id: String,
    pub mission: String,
    pub tech_stack: String,
    pub architecture: String,
    pub coding_style: String,
    pub current_milestone: String,
    pub priority: String,
    pub known_problems: String,
    pub updated_at: String,
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

// ── Workspace Graph (Phase 2) ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub workspace_id: String,
    pub node_type: String, // "file" | "directory" | "symbol"
    pub name: String,
    pub path: String,
    pub language: String,
    pub symbol_kind: String,
    pub size: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl GraphNode {
    pub fn new(
        workspace_id: impl Into<String>,
        node_type: impl Into<String>,
        name: impl Into<String>,
        path: impl Into<String>,
    ) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            node_type: node_type.into(),
            name: name.into(),
            path: path.into(),
            language: String::new(),
            symbol_kind: String::new(),
            size: 0,
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub workspace_id: String,
    pub source_id: String,
    pub target_id: String,
    pub edge_type: String, // "contains" | "defines" | "imports" | "references"
    pub created_at: String,
}

impl GraphEdge {
    pub fn new(
        workspace_id: impl Into<String>,
        source_id: impl Into<String>,
        target_id: impl Into<String>,
        edge_type: impl Into<String>,
    ) -> Self {
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            source_id: source_id.into(),
            target_id: target_id.into(),
            edge_type: edge_type.into(),
            created_at: now_str(),
        }
    }
}

// ── Graph Snapshot (IPC payload) ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSnapshot {
    pub workspace_id: String,
    pub scanned_files: usize,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub scanned_at: String,
}

// ── Timeline Event (Phase 3) ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    pub payload: String,
    pub title: String,
    pub description: String,
    pub created_at: String,
}

impl TimelineEvent {
    pub fn new(
        workspace_id: impl Into<String>,
        kind: impl Into<String>,
        title: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            id: new_id(),
            workspace_id: workspace_id.into(),
            kind: kind.into(),
            payload: "{}".into(),
            title: title.into(),
            description: description.into(),
            created_at: now_str(),
        }
    }
}

// ── Agent Memory (Phase 4) ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub project_id: String,
    pub workspace_id: String,
    pub r#type: String,
    pub key: String,
    pub value: String,
    pub context: String,
    pub source: String, // "user-confirmed" | "ai-inferred" | "agent-observed"
    pub confidence: Option<f64>,
    pub origin_session_id: String,
    pub created_at: String,
    pub updated_at: String,
}

impl MemoryEntry {
    pub fn new(
        project_id: impl Into<String>,
        workspace_id: impl Into<String>,
        r#type: impl Into<String>,
        key: impl Into<String>,
        value: impl Into<String>,
        context: impl Into<String>,
    ) -> Self {
        let ts = now_str();
        Self {
            id: new_id(),
            project_id: project_id.into(),
            workspace_id: workspace_id.into(),
            r#type: r#type.into(),
            key: key.into(),
            value: value.into(),
            context: context.into(),
            source: "user-confirmed".into(),
            confidence: None,
            origin_session_id: String::new(),
            created_at: ts.clone(),
            updated_at: ts,
        }
    }
}
