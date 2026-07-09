// ── Agent State ───────────────────────────────────────────────────────────
// Central memory object for a single agent run.

use crate::agent::actions::{Action, ToolResult};
use std::collections::VecDeque;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub action_id: String,
    pub success: bool,
    pub summary: String,
    pub output: Option<String>,
    pub error: Option<String>,
}

pub struct AgentState {
    pub goal: String,
    pub workspace_path: String,
    pub task_queue: VecDeque<Action>,
    pub completed_actions: Vec<Action>,
    pub observations: Vec<Observation>,
    pub files_created: Vec<String>,
    pub files_modified: Vec<String>,
    pub current_errors: Vec<String>,
    pub retry_count: usize,
    pub is_running: bool,
    pub is_complete: bool,
    pub abort_requested: bool,
}

impl AgentState {
    pub fn new(goal: String, workspace_path: String) -> Self {
        Self {
            goal,
            workspace_path,
            task_queue: VecDeque::new(),
            completed_actions: vec![],
            observations: vec![],
            files_created: vec![],
            files_modified: vec![],
            current_errors: vec![],
            retry_count: 0,
            is_running: true,
            is_complete: false,
            abort_requested: false,
        }
    }

    pub fn record_completed(&mut self, action: Action, result: &ToolResult) {
        if let Some(path) = &action.path {
            match action.action_type {
                crate::agent::actions::ActionType::WriteFile => {
                    if !self.files_created.contains(path) {
                        self.files_created.push(path.clone());
                    }
                }
                crate::agent::actions::ActionType::EditFile => {
                    if !self.files_modified.contains(path) {
                        self.files_modified.push(path.clone());
                    }
                }
                _ => {}
            }
        }

        if let Some(err) = &result.error {
            self.current_errors.push(err.clone());
        }

        self.completed_actions.push(action);
    }

    /// Build a context string for LLM role prompts.
    pub fn build_context(&self) -> String {
        let recent_obs: Vec<String> = self.observations.iter().rev().take(5)
            .map(|o| format!("[{}] {}: {}", if o.success { "OK" } else { "FAIL" }, o.action_id, o.summary))
            .collect();

        format!(
            "GOAL: {}\nWORKSPACE: {}\nFILES CREATED: {:?}\nFILES MODIFIED: {:?}\nERRORS: {:?}\nRECENT OBSERVATIONS:\n{}",
            self.goal,
            self.workspace_path,
            self.files_created,
            self.files_modified,
            self.current_errors,
            recent_obs.join("\n"),
        )
    }

    pub fn can_retry(&self) -> bool {
        self.retry_count < 3
    }
}
