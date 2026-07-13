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
    ///
    /// Observations use a **token budget** rather than a fixed count.
    /// A single `cargo test` run can produce 3 000 lines while `cargo build`
    /// may produce only 2, so limiting by token estimate keeps the planner
    /// prompt consistently informative without blowing the context window.
    ///
    /// Budget: ~2 500 tokens for the observations section (~4 chars / token).
    pub fn build_context(&self) -> String {
        // ── Token budget helpers ───────────────────────────────────────────
        // 4 chars ≈ 1 token (conservative ASCII estimate).
        fn estimate_tokens(s: &str) -> usize {
            (s.len() + 3) / 4
        }
        const OBS_TOKEN_BUDGET: usize = 2500;

        // ── Completed actions (last 10, short — fixed cost) ───────────────
        let completed_summary: Vec<String> = self
            .completed_actions
            .iter()
            .rev()
            .take(10)
            .map(|a| format!("[DONE] {:?}: {}", a.action_type, a.description))
            .collect();

        // ── Recent thoughts from completed actions (last 5) ────────────────
        // These are the planner's own reasoning snippets, captured from the
        // `thought` field and replayed so it can build on prior reasoning.
        let thoughts: Vec<String> = self
            .completed_actions
            .iter()
            .rev()
            .filter_map(|a| a.thought.as_ref())
            .take(5)
            .map(|t| format!("- {}", t))
            .collect();

        // ── Token-aware observations (newest first) ────────────────────────
        // Walk from newest to oldest and stop once the running token total
        // exceeds OBS_TOKEN_BUDGET.  Each observation's output is capped at
        // 1 000 chars so a single huge log can't crowd out everything else.
        let mut obs_lines: Vec<String> = Vec::new();
        let mut tokens_used: usize = 0;

        for obs in self.observations.iter().rev() {
            let output_snippet = match &obs.output {
                Some(out) if !out.is_empty() => {
                    let snippet: String = out.chars().take(1000).collect();
                    format!("\n  OUTPUT: {}", snippet)
                }
                _ => String::new(),
            };

            let line = format!(
                "[{}] {}{}",
                if obs.success { "OK" } else { "FAIL" },
                obs.summary,
                output_snippet
            );

            let line_tokens = estimate_tokens(&line);
            if tokens_used + line_tokens > OBS_TOKEN_BUDGET {
                break;
            }
            tokens_used += line_tokens;
            obs_lines.push(line);
        }

        format!(
            "GOAL: {goal}\n\
             WORKSPACE: {workspace}\n\
             FILES CREATED: {created:?}\n\
             FILES MODIFIED: {modified:?}\n\
             ERRORS: {errors:?}\n\
             COMPLETED ACTIONS (most recent first):\n{completed}\n\
             RECENT THOUGHTS:\n{thoughts}\n\
             RECENT OBSERVATIONS (newest first, ~{tokens} tokens):\n{obs}",
            goal      = self.goal,
            workspace = self.workspace_path,
            created   = self.files_created,
            modified  = self.files_modified,
            errors    = self.current_errors,
            completed = if completed_summary.is_empty() {
                "  (none yet)".to_string()
            } else {
                completed_summary.join("\n")
            },
            thoughts  = if thoughts.is_empty() {
                "  (none yet)".to_string()
            } else {
                thoughts.join("\n")
            },
            tokens    = tokens_used,
            obs       = if obs_lines.is_empty() {
                "  (none yet)".to_string()
            } else {
                obs_lines.join("\n")
            },
        )
    }

    pub fn can_retry(&self) -> bool {
        self.retry_count < 3
    }
}
