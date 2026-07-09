// ── Observer Role ─────────────────────────────────────────────────────────
// Builds a structured observation from a tool result.

use crate::agent::actions::{Action, ActionType, ToolResult};
use crate::agent::state::Observation;

pub fn observe(action: &Action, result: &ToolResult) -> Observation {
    let summary = if result.success {
        match action.action_type {
            ActionType::WriteFile => format!(
                "Wrote file: {}",
                action.path.as_deref().unwrap_or("?")
            ),
            ActionType::ReadFile => format!(
                "Read file: {} ({} chars)",
                action.path.as_deref().unwrap_or("?"),
                result.output.as_deref().unwrap_or("").len()
            ),
            ActionType::RunCommand => format!(
                "Command succeeded (exit 0): {}",
                action.command.as_deref().unwrap_or("?")
            ),
            ActionType::ListDirectory => format!(
                "Listed: {}",
                action.path.as_deref().unwrap_or("?")
            ),
            ActionType::Done => "Goal completed".into(),
            _ => format!("Action {:?} succeeded", action.action_type),
        }
    } else {
        format!(
            "Action {:?} FAILED: {}",
            action.action_type,
            result.error.as_deref().unwrap_or("unknown error")
        )
    };

    Observation {
        action_id: action.id.clone(),
        success: result.success,
        summary,
        output: result.output.clone(),
        error: result.error.clone(),
    }
}
