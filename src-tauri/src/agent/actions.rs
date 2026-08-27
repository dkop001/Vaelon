// ── Agent Actions ─────────────────────────────────────────────────────────
// Typed action enum. Planner includes content directly (no separate codegen).

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
    Think,
    Done,
}

impl AsRef<str> for ActionType {
    fn as_ref(&self) -> &str {
        match self {
            ActionType::WriteFile => "WRITE_FILE",
            ActionType::ReadFile => "READ_FILE",
            ActionType::EditFile => "EDIT_FILE",
            ActionType::DeleteFile => "DELETE_FILE",
            ActionType::ListDirectory => "LIST_DIRECTORY",
            ActionType::RunCommand => "RUN_COMMAND",
            ActionType::SearchCode => "SEARCH_CODE",
            ActionType::Think => "THINK",
            ActionType::Done => "DONE",
        }
    }
}

/// Approval policy for agent actions.
/// - once:   approve this exact command only; subsequent similar commands need approval
/// - task:   approve for this entire agent run/task; subsequent commands may proceed
/// - always: auto-allow safe commands (e.g. package installation) without per-command approval
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ApprovalPolicy {
    Once,
    Task,
    Always,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Action {
    pub id: String,
    pub action_type: ActionType,
    /// Approval policy: once/task/always
    pub approval_policy: ApprovalPolicy,
    /// File path (for file operations)
    pub path: Option<String>,
    /// File content (for WRITE_FILE / EDIT_FILE) — planner includes this directly
    pub content: Option<String>,
    /// Shell command (for RUN_COMMAND)
    pub command: Option<String>,
    /// Working directory for command execution
    pub cwd: Option<String>,
    /// Search query (for SEARCH_CODE)
    pub query: Option<String>,
    /// Human-readable description
    pub description: String,
    /// The planner's reasoning
    pub thought: Option<String>,
    /// How many times this action has been retried
    pub retry_count: usize,
}

impl Action {
    pub fn new(action_type: ActionType, description: impl Into<String>, approval_policy: ApprovalPolicy) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            action_type,
            approval_policy,
            path: None,
            content: None,
            command: None,
            cwd: None,
            query: None,
            description: description.into(),
            thought: None,
            retry_count: 0,
        }
    }

    pub fn write_file(path: impl Into<String>, content: impl Into<String>, desc: impl Into<String>, approval_policy: ApprovalPolicy) -> Self {
        Self {
            action_type: ActionType::WriteFile,
            path: Some(path.into()),
            content: Some(content.into()),
            description: desc.into(),
            approval_policy: approval_policy.clone(),
            ..Self::new(ActionType::WriteFile, "", approval_policy)
        }
    }

    pub fn run_command(command: impl Into<String>, cwd: Option<String>, desc: impl Into<String>, approval_policy: ApprovalPolicy) -> Self {
        Self {
            action_type: ActionType::RunCommand,
            command: Some(command.into()),
            cwd,
            description: desc.into(),
            approval_policy: approval_policy.clone(),
            ..Self::new(ActionType::RunCommand, "", approval_policy)
        }
    }

    pub fn think(description: impl Into<String>, approval_policy: ApprovalPolicy) -> Self {
        Self {
            action_type: ActionType::Think,
            description: description.into(),
            ..Self::new(ActionType::Think, "", approval_policy.clone())
        }
    }

    pub fn done(approval_policy: ApprovalPolicy) -> Self {
        Self::new(ActionType::Done, "Goal completed", approval_policy)
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
