// ── Agent Runtime ─────────────────────────────────────────────────────────
// Orchestrates the multi-role reasoning loop in Rust.
// Port of the JS AgentLoop / AgentState / TaskQueue system.
//
// Tauri events emitted:
//   agent:reasoning_started   { run_id, goal }
//   agent:action_created      { run_id, action }
//   agent:observation         { run_id, observation }
//   agent:tool_blocked        { run_id, action_id, reason }
//   agent:goal_completed      { run_id, summary }
//   agent:failed              { run_id, reason }

pub mod actions;
pub mod roles;
pub mod state;
pub mod tools;
pub mod recovery;

use crate::agent::{
    actions::{Action, ActionType},
    roles::{codegen, observer, planner, reviewer},
    state::AgentState,
    tools::ToolExecutor,
    recovery::analyze_failure,
};
use crate::db::DbPool;
use crate::llm::LlmSettings;
use anyhow::Result;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ── Event Payloads ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStartedEvent {
    pub run_id: String,
    pub goal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentActionEvent {
    pub run_id: String,
    pub action: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentObservationEvent {
    pub run_id: String,
    pub observation: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentBlockedEvent {
    pub run_id: String,
    pub action_id: String,
    pub reason: String,
    pub requires_approval: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCompletedEvent {
    pub run_id: String,
    pub goal: String,
    pub files_created: usize,
    pub files_modified: usize,
    pub actions_completed: usize,
    pub errors: usize,
    pub status: String,
}

// ── Agent Manager ─────────────────────────────────────────────────────────

pub struct AgentManager {
    /// Active run states keyed by run_id
    pub runs: DashMap<String, Arc<Mutex<AgentState>>>,
    /// Pending approvals for blocked actions
    pub pending_approvals: DashMap<String, tokio::sync::oneshot::Sender<()>>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            runs: DashMap::new(),
            pending_approvals: DashMap::new(),
        }
    }

    /// Start a new agent run. Spawns a Tokio task.
    pub fn start(
        &self,
        app: AppHandle,
        goal: String,
        workspace_path: String,
        db: DbPool,
        llm_settings: LlmSettings,
    ) -> String {
        let run_id = Uuid::new_v4().to_string();
        let state = Arc::new(Mutex::new(AgentState::new(goal.clone(), workspace_path.clone())));
        self.runs.insert(run_id.clone(), state.clone());

        let run_id_clone = run_id.clone();
        let pending_approvals = Arc::new(DashMap::<String, tokio::sync::oneshot::Sender<()>>::new());
        let pending_clone = pending_approvals.clone();

        tauri::async_runtime::spawn(async move {
            let _ = app.emit("agent:reasoning_started", AgentStartedEvent {
                run_id: run_id_clone.clone(),
                goal: goal.clone(),
            });

            let result = agent_loop(
                app.clone(),
                run_id_clone.clone(),
                state.clone(),
                db,
                llm_settings,
                pending_approvals,
            ).await;

            match result {
                Ok(summary) => {
                    let _ = app.emit("agent:goal_completed", summary);
                }
                Err(e) => {
                    tracing::error!("Agent loop failed for run {}: {:?}", run_id_clone, e);
                    let _ = app.emit("agent:failed", serde_json::json!({
                        "run_id": run_id_clone,
                        "reason": e.to_string()
                    }));
                }
            }
        });

        run_id
    }

    /// Stop a running agent.
    pub fn stop(&self, run_id: &str) {
        if let Some(state) = self.runs.get(run_id) {
            let mut s = state.lock().unwrap();
            s.abort_requested = true;
            s.is_running = false;
        }
    }

    /// Approve a blocked action.
    pub fn approve(&self, action_id: &str) {
        if let Some((_, sender)) = self.pending_approvals.remove(action_id) {
            let _ = sender.send(());
        }
    }
}

// ── Main Agent Loop ────────────────────────────────────────────────────────

async fn agent_loop(
    app: AppHandle,
    run_id: String,
    state: Arc<Mutex<AgentState>>,
    db: DbPool,
    llm_settings: LlmSettings,
    pending_approvals: Arc<DashMap<String, tokio::sync::oneshot::Sender<()>>>,
) -> Result<AgentCompletedEvent> {
    let executor = ToolExecutor::new(db.clone());
    const MAX_ITERATIONS: usize = 50;

    for iteration in 0..MAX_ITERATIONS {
        let (is_running, abort_requested, is_complete) = {
            let s = state.lock().unwrap();
            (s.is_running, s.abort_requested, s.is_complete)
        };

        if !is_running || abort_requested || is_complete {
            break;
        }

        // 1. Get next action (from queue or planner)
        let maybe_action = {
            let mut s = state.lock().unwrap();
            s.task_queue.pop_front()
        };

        let action = if let Some(action) = maybe_action {
            action
        } else {
            // Ask the planner
            let context = {
                let s = state.lock().unwrap();
                s.build_context()
            };
            planner::plan_next(&context, &llm_settings).await?
        };

        // Emit action event
        let _ = app.emit("agent:action_created", AgentActionEvent {
            run_id: run_id.clone(),
            action: serde_json::to_value(&action).unwrap_or_default(),
        });

        // 2. DONE signal
        if action.action_type == ActionType::Done {
            break;
        }

        // 3. If WRITE_FILE and no content yet, generate via CodeGen
        let action = if action.action_type == ActionType::WriteFile && action.content.is_none() {
            let context = {
                let s = state.lock().unwrap();
                s.build_context()
            };
            let content = codegen::generate(&action, &context, &llm_settings).await?;
            // Review generated code
            let review = reviewer::review_file(action.path.as_deref().unwrap_or(""), &content);
            if !review.pass {
                tracing::warn!("Code review failed for {:?}: {:?}", action.path, review.issues);
            }
            Action { content: Some(content), ..action }
        } else {
            action
        };

        // 4. Execute
        let result = executor.execute(&action).await;

        // 5. Observe
        let obs = observer::observe(&action, &result);
        let _ = app.emit("agent:observation", AgentObservationEvent {
            run_id: run_id.clone(),
            observation: obs.summary.clone(),
            success: obs.success,
        });

        // 6. Update state
        {
            let mut s = state.lock().unwrap();
            // Always store the observation so build_context() surfaces it on
            // the next iteration — both successes AND failures need to be
            // visible to the Planner, otherwise it retries blindly.
            s.observations.push(obs.clone());
            if obs.success {
                s.record_completed(action.clone(), &result);
            } else {
                // Generate repair tasks
                let repairs = analyze_failure(&action, &result);
                for r in repairs {
                    s.task_queue.push_front(r);
                }
            }
        }
    }

    // Build summary
    let summary = {
        let s = state.lock().unwrap();
        AgentCompletedEvent {
            run_id: run_id.clone(),
            goal: s.goal.clone(),
            files_created: s.files_created.len(),
            files_modified: s.files_modified.len(),
            actions_completed: s.completed_actions.len(),
            errors: s.current_errors.len(),
            status: if s.current_errors.is_empty() { "success".into() } else { "partial".into() },
        }
    };

    Ok(summary)
}
