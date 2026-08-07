// ── Failure Recovery ──────────────────────────────────────────────────────
// Integrated self-healing: failure → collect → diagnose → retry → verify.
// Diagnosis logic is now in worker.rs. This module provides the recovery
// strategy interface for the runtime to decide whether/how to retry.

use crate::agent::actions::ToolResult;
use crate::agent::task_graph::TaskGraph;
use crate::agent::world_state::WorldState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryDiagnosis {
    pub should_retry: bool,
    pub requires_replan: bool,
    pub reason: String,
    pub suggested_approach: Option<String>,
}

/// Analyze a failure and determine the recovery strategy.
pub fn analyze_failure(
    task_id: &str,
    graph: &TaskGraph,
    _result: &ToolResult,
    _state: &Arc<Mutex<WorldState>>,
) -> RecoveryDiagnosis {
    let task = match graph.get(task_id) {
        Some(t) => t,
        None => return RecoveryDiagnosis {
            should_retry: false,
            requires_replan: true,
            reason: "Task not found in graph".into(),
            suggested_approach: None,
        },
    };

    // Check retry count
    if task.action.as_ref().map(|a| a.retry_count).unwrap_or(0) >= 3 {
        return RecoveryDiagnosis {
            should_retry: false,
            requires_replan: true,
            reason: format!("Task '{}' failed after 3 retries", task.description),
            suggested_approach: Some("Try a different approach. Read the error details and replan.".into()),
        };
    }

    RecoveryDiagnosis {
        should_retry: true,
        requires_replan: false,
        reason: "Standard retry with diagnostics".into(),
        suggested_approach: Some("Rerun with additional context from previous failure".into()),
    }
}
