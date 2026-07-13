// ── Agent Actions ─────────────────────────────────────────────────────────
// Typed action enum matching the JS ActionType constants.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ActionType {
    WriteFile,
    ReadFile,
    EditFile,
    DeleteFile,
    ListDirectory,
    RunCommand,
    SearchCode,
    FetchUrl,
    Think,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub action_type: ActionType,
    /// File path (for file operations)
    pub path: Option<String>,
    /// File content (for WRITE_FILE / EDIT_FILE)
    pub content: Option<String>,
    /// Shell command (for RUN_COMMAND)
    pub command: Option<String>,
    /// Working directory for command execution
    pub cwd: Option<String>,
    /// Search query (for SEARCH_CODE)
    pub query: Option<String>,
    /// URL (for FETCH_URL)
    pub url: Option<String>,
    /// Human-readable description
    pub description: String,
    /// The planner's raw reasoning that produced this action.
    /// Captured from the `thought` field of the planner's JSON response
    /// and fed back into build_context() so future iterations can see it.
    pub thought: Option<String>,
    /// How many times this action has been retried
    pub retry_count: usize,
    /// Whether this was auto-generated as a repair
    pub is_repair: bool,
}

impl Action {
    pub fn new(action_type: ActionType, description: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            action_type,
            path: None,
            content: None,
            command: None,
            cwd: None,
            query: None,
            url: None,
            description: description.into(),
            thought: None,
            retry_count: 0,
            is_repair: false,
        }
    }

    pub fn write_file(path: impl Into<String>, content: impl Into<String>, desc: impl Into<String>) -> Self {
        Self {
            action_type: ActionType::WriteFile,
            path: Some(path.into()),
            content: Some(content.into()),
            description: desc.into(),
            ..Self::new(ActionType::WriteFile, "")
        }
    }

    pub fn run_command(command: impl Into<String>, cwd: Option<String>, desc: impl Into<String>) -> Self {
        Self {
            action_type: ActionType::RunCommand,
            command: Some(command.into()),
            cwd,
            description: desc.into(),
            ..Self::new(ActionType::RunCommand, "")
        }
    }
}

/// Result of a tool execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub exit_code: Option<i32>,
}
