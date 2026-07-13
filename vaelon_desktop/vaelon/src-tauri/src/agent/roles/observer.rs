// ── Observer Role ─────────────────────────────────────────────────────────
// Builds a structured observation from a tool result.
// Failure summaries embed the actual error/stderr so the Planner can
// read exactly what went wrong in RECENT OBSERVATIONS without having to
// guess or retry blindly.

use crate::agent::actions::{Action, ActionType, ToolResult};
use crate::agent::state::Observation;

pub fn observe(action: &Action, result: &ToolResult) -> Observation {
    let summary = if result.success {
        match action.action_type {
            ActionType::WriteFile => format!(
                "Wrote file: {}",
                action.path.as_deref().unwrap_or("?")
            ),
            ActionType::EditFile => format!(
                "Edited (overwrote) file: {}",
                action.path.as_deref().unwrap_or("?")
            ),
            ActionType::ReadFile => format!(
                "Read file: {} ({} chars)",
                action.path.as_deref().unwrap_or("?"),
                result.output.as_deref().unwrap_or("").len()
            ),
            ActionType::RunCommand => format!(
                "Command succeeded (exit 0): `{}`",
                action.command.as_deref().unwrap_or("?")
            ),
            ActionType::ListDirectory => format!(
                "Listed: {}",
                action.path.as_deref().unwrap_or("?")
            ),
            // Surface the thought content so it appears in RECENT OBSERVATIONS
            // and the Planner can refer back to its own prior reasoning.
            ActionType::Think => format!(
                "Thought: {}",
                result.output.as_deref().unwrap_or("(no content)")
            ),
            ActionType::Done => "Goal completed".into(),
            _ => format!("Action {:?} succeeded", action.action_type),
        }
    } else {
        // Embed specific error details per action type so the Planner sees
        // the real reason for failure, not just a generic "FAILED" string.
        match action.action_type {
            ActionType::RunCommand => {
                let stderr = result.error.as_deref().unwrap_or("unknown");
                let snippet: String = stderr.chars().take(300).collect();
                format!(
                    "Command FAILED (exit {}): `{}` — stderr: {}",
                    result.exit_code.unwrap_or(-1),
                    action.command.as_deref().unwrap_or("?"),
                    snippet
                )
            }
            ActionType::WriteFile | ActionType::EditFile => format!(
                "Failed to write `{}`: {}",
                action.path.as_deref().unwrap_or("?"),
                result.error.as_deref().unwrap_or("unknown error")
            ),
            ActionType::ReadFile => format!(
                "Failed to read `{}`: {}",
                action.path.as_deref().unwrap_or("?"),
                result.error.as_deref().unwrap_or("unknown error")
            ),
            _ => format!(
                "Action {:?} FAILED: {}",
                action.action_type,
                result.error.as_deref().unwrap_or("unknown error")
            ),
        }
    };

    Observation {
        action_id: action.id.clone(),
        success: result.success,
        summary,
        output: result.output.clone(),
        error: result.error.clone(),
    }
}
