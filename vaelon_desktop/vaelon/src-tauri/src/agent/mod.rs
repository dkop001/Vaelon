// ── Agent Runtime ─────────────────────────────────────────────────────────
// WorldState-centric architecture.
//
// Goal → Mission Planner → Task Graph → Scheduler → Worker → Verification → World State → Planner (only if needed)
//
// The planner is no longer in the hot loop. It is consulted only when:
//   a task needs decomposition,
//   execution reaches a dead end,
//   verification fails,
//   the goal changes.
//
// Everything else is deterministic.
//
// Tauri events emitted:
//   agent:reasoning_started  { run_id, goal }
//   agent:action_created     { run_id, action, world_state_snapshot }
//   agent:observation        { run_id, tool_call }
//   agent:task_update        { run_id, task_id, status, description }
//   agent:goal_completed     { run_id, summary }
//   agent:failed             { run_id, reason }

pub mod actions;
pub mod roles;
pub mod world_state;
pub mod task_graph;
pub mod worker;
pub mod verifier;
pub mod recovery;

use crate::agent::{
    actions::{Action, ActionType},
    roles::planner::Planner,
    task_graph::{Scheduler, TaskGraph, TaskStatus},
    worker::Worker,
    verifier::Verifier,
    world_state::WorldState,
    recovery::analyze_failure,
};
use crate::db::DbPool;
use crate::llm::LlmSettings;
use anyhow::Result;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

// ── Event Payloads ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStartedEvent {
    pub run_id: String,
    pub goal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentActionEvent {
    pub run_id: String,
    pub action: serde_json::Value,
    pub world_state_snapshot: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentObservationEvent {
    pub run_id: String,
    pub tool_call: serde_json::Value,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTaskUpdateEvent {
    pub run_id: String,
    pub task_id: String,
    pub status: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCompletedEvent {
    pub run_id: String,
    pub goal: String,
    pub files_created: usize,
    pub files_modified: usize,
    pub actions_completed: usize,
    pub tasks_total: usize,
    pub tasks_failed: usize,
    pub errors: usize,
    pub status: String,
}

// ── Agent Manager ──────────────────────────────────────────────────────

pub struct AgentManager {
    /// Active run states keyed by run_id
    pub runs: DashMap<String, Arc<Mutex<WorldState>>>,
    /// Pending approvals for blocked actions
    pub pending_approvals: DashMap<String, tokio::sync::oneshot::Sender<()>>,
    /// Worker per run
    workers: DashMap<String, Worker>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            runs: DashMap::new(),
            pending_approvals: DashMap::new(),
            workers: DashMap::new(),
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
        let state = Arc::new(Mutex::new(WorldState::new(goal.clone(), workspace_path.clone())));
        self.runs.insert(run_id.clone(), state.clone());
        self.workers.insert(run_id.clone(), Worker::new());

        let run_id_clone = run_id.clone();
        let pending_approvals = Arc::new(DashMap::<String, tokio::sync::oneshot::Sender<()>>::new());
        let _pending_clone = pending_approvals.clone();

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
        self.runs.remove(run_id);
        self.workers.remove(run_id);
    }

    /// Approve a blocked action (future use).
    pub fn approve(&self, action_id: &str) {
        if let Some((_, sender)) = self.pending_approvals.remove(action_id) {
            let _ = sender.send(());
        }
    }
}

// ── Main Agent Loop ────────────────────────────────────────────────────

async fn agent_loop(
    app: AppHandle,
    run_id: String,
    state: Arc<Mutex<WorldState>>,
    _db: DbPool,
    llm_settings: LlmSettings,
    _pending_approvals: Arc<DashMap<String, tokio::sync::oneshot::Sender<()>>>,
) -> Result<AgentCompletedEvent> {
    // Phase 1: Initial planning — decompose goal into task graph
    let mut graph = TaskGraph::new();
    let root_id = graph.add_root({
        let ws = state.lock().await;
        ws.goal.clone()
    });

    let initial_action = Planner::plan_next(&state, &llm_settings).await?;

    // If planner returns an expand-type thought, use it to populate the graph
    if initial_action.action_type == ActionType::Think && !graph.is_empty() {
        // Try to expand the root task
        let description = {
            let ws = state.lock().await;
            ws.goal.clone()
        };
        let subtasks = Planner::expand_task(&description, &state, &llm_settings).await?;
        for task in subtasks {
            let task_id = task.id.clone();
            let desc = task.description.clone();
            graph.add_child(&root_id, desc, task.priority);
            if let Some(action) = task.action {
                if let Some(child) = graph.nodes_with_status(TaskStatus::Waiting).first() {
                    let child_id = child.id.clone();
                    graph.set_action(&child_id, action);
                }
            }
            // Set dependencies
            for dep_id in task.dependencies {
                graph.add_dependency(&task_id, &dep_id);
            }
        }
    }

    // Phase 2: Execution loop
    // Stop when: TaskGraph empty, all tasks terminal, or fatal error
    loop {
        // Check if agent was stopped
        if !state_available(&state).await {
            break;
        }

        // Check completion conditions
        if graph.is_empty() {
            tracing::info!("Task graph is empty — goal achieved");
            break;
        }

        if graph.is_complete() {
            tracing::info!("All tasks finished — goal {}", if graph.is_success() { "achieved" } else { "partially completed" });
            break;
        }

        // Ask scheduler for the next task
        let task = match Scheduler::next_task(&graph) {
            Some(t) => t,
            None => {
                // No tasks ready. Check for deadlock or blockages.
                let blocked: Vec<String> = graph.nodes_with_status(TaskStatus::Blocked)
                    .iter().map(|n| n.description.clone()).collect();
                let waiting: Vec<String> = graph.nodes_with_status(TaskStatus::Waiting)
                    .iter().map(|n| n.description.clone()).collect();

                if !blocked.is_empty() {
                    // Try to unblock via planner
                    tracing::warn!("{} tasks blocked — consulting planner", blocked.len());
                    let action = Planner::plan_next(&state, &llm_settings).await?;
                    if action.action_type == ActionType::Done {
                        break;
                    }
                    // Execute the unblock action directly
                    {
                        let mut ws = state.lock().await;
                        ws.set_focus(format!("Unblocking: {}", action.description));
                    }
                    let result = {
                        let worker = Worker::new();
                        worker.execute_tool(&action, &state).await
                    };
                    if !result.success {
                        // Still blocked — check for fatality
                        let error_count = state.lock().await.diagnostics.len();
                        if error_count > 20 {
                            return Err(anyhow::anyhow!("Too many blocked tasks — fatal"));
                        }
                    }
                    continue;
                }

                if waiting.is_empty() {
                    // All tasks are terminal — done
                    break;
                }

                // Waiting tasks have unmet dependencies — check if those dependencies failed
                let failed_deps: Vec<String> = graph.nodes_with_status(TaskStatus::Failed)
                    .iter().map(|n| n.description.clone()).collect();
                if !failed_deps.is_empty() {
                    // Some dependencies failed — need to replan
                    tracing::warn!("Dependencies failed: {:?} — consulting planner", failed_deps);
                    let action = Planner::plan_next(&state, &llm_settings).await?;
                    if action.action_type == ActionType::Done {
                        break;
                    }
                    // Add the plan action as a new task
                    let task_id = graph.add_child(&root_id, &action.description, 99);
                    if let Some(id) = task_id {
                        graph.set_action(&id, action);
                    }
                    continue;
                }

                // True deadlock
                tracing::warn!("Deadlock detected — consulting planner");
                let action = Planner::plan_next(&state, &llm_settings).await?;
                if action.action_type == ActionType::Done {
                    break;
                }
                let task_id = graph.add_child(&root_id, &action.description, 99);
                if let Some(id) = task_id {
                    graph.set_action(&id, action);
                }
                continue;
            }
        };

        // Mark as running
        let task_id = task.id.clone();
        let task_desc = task.description.clone();
        graph.set_status(&task_id, TaskStatus::Running);

        // Emit task update
        let _ = app.emit("agent:task_update", AgentTaskUpdateEvent {
            run_id: run_id.clone(),
            task_id: task_id.clone(),
            status: "running".into(),
            description: task_desc.clone(),
        });

        // Check if task has an action, or needs planning
        if task.action.is_none() {
            // Task needs expansion — ask planner
            let subtasks = Planner::expand_task(&task_desc, &state, &llm_settings).await?;
            if subtasks.is_empty() {
                graph.set_status(&task_id, TaskStatus::Finished);
                continue;
            }
            // Add subtasks to graph
            for st in &subtasks {
                let child_id = graph.add_child(&task_id, &st.description, st.priority);
                if let Some(id) = child_id {
                    if let Some(action) = &st.action {
                        graph.set_action(&id, action.clone());
                    }
                    // Copy dependencies
                    for dep in &st.dependencies {
                        graph.add_dependency(&id, dep);
                    }
                }
            }
            graph.set_status(&task_id, TaskStatus::Finished);
            continue;
        }

        // Set focus
        {
            let mut ws = state.lock().await;
            ws.set_focus(format!("Executing: {}", task_desc));
        }

        // Emit action event
        if let Some(action) = &task.action {
            let ws_snapshot = {
                let ws = state.lock().await;
                ws.to_planner_json()
            };
            let _ = app.emit("agent:action_created", AgentActionEvent {
                run_id: run_id.clone(),
                action: serde_json::to_value(action).unwrap_or_default(),
                world_state_snapshot: serde_json::from_str(&ws_snapshot).unwrap_or_default(),
            });
        }

        // Execute via Worker
        let worker = Worker::new();
        let result = worker.execute(&task, &state).await;

        // Emit observation
        let _ = app.emit("agent:observation", AgentObservationEvent {
            run_id: run_id.clone(),
            tool_call: serde_json::json!({
                "action": task.action.as_ref().map(|a| serde_json::to_value(a).unwrap_or_default()),
                "result": {
                    "success": result.success,
                    "output": result.output,
                    "error": result.error,
                    "exit_code": result.exit_code,
                }
            }),
            success: result.success,
        });

        // Store result on task
        graph.set_result(&task_id, result.clone());

        if result.success {
            // Verification
            let workspace_path = {
                let ws = state.lock().await;
                ws.workspace_path.clone()
            };
            let action = task.action.as_ref().cloned().unwrap_or_else(|| {
                Action { id: String::new(), action_type: ActionType::Think, path: None, content: None, command: None, cwd: None, query: None, description: "verify task".into(), thought: None, retry_count: 0 }
            });
            let verification = Verifier::verify(&workspace_path, &action).await;

            if verification.passed {
                graph.set_status(&task_id, TaskStatus::Finished);
                {
                    let mut ws = state.lock().await;
                    ws.completed.push(task_desc.clone());
                    ws.push_diagnostic(format!("Task completed: {} — verified OK", task_desc));
                }
            } else {
                graph.set_status(&task_id, TaskStatus::Failed);
                {
                    let mut ws = state.lock().await;
                    ws.failed.push(task_desc.clone());
                    for err in &verification.errors {
                        ws.push_diagnostic(format!("Verification failed for '{}': {}", task_desc, err));
                    }
                }

                // Check recovery strategy
                let diagnosis = analyze_failure(&task_id, &graph, &result, &state);
                if diagnosis.requires_replan {
                    // Consult planner for recovery
                    tracing::warn!("Task '{}' failed verification — replanning", task_desc);
                    let recovery_action = Planner::plan_next(&state, &llm_settings).await?;
                    if recovery_action.action_type != ActionType::Done {
                        let recovery_id = graph.add_child(&root_id, &recovery_action.description, 99);
                        if let Some(id) = recovery_id {
                            graph.set_action(&id, recovery_action);
                        }
                    }
                } else if diagnosis.should_retry {
                    // Retry with incremented retry count
                    if let Some(t) = graph.get_mut(&task_id) {
                        if let Some(ref mut a) = t.action {
                            a.retry_count += 1;
                        }
                        t.status = TaskStatus::Waiting;
                    }
                }
            }
        } else {
            // Execution failed
            graph.set_status(&task_id, TaskStatus::Failed);
            {
                let mut ws = state.lock().await;
                ws.failed.push(task_desc.clone());
                ws.push_diagnostic(format!(
                    "Task failed: {} — {}",
                    task_desc,
                    result.error.as_deref().unwrap_or("unknown error")
                ));
            }

            // Recovery
            let diagnosis = analyze_failure(&task_id, &graph, &result, &state);
            if diagnosis.requires_replan {
                let recovery_action = Planner::plan_next(&state, &llm_settings).await?;
                if recovery_action.action_type != ActionType::Done {
                    let recovery_id = graph.add_child(&root_id, &recovery_action.description, 99);
                    if let Some(id) = recovery_id {
                        graph.set_action(&id, recovery_action);
                    }
                }
            } else if diagnosis.should_retry {
                if let Some(t) = graph.get_mut(&task_id) {
                    if let Some(ref mut a) = t.action {
                        a.retry_count += 1;
                    }
                    t.status = TaskStatus::Waiting;
                }
            }

            // Check for fatal error condition
            let failed_count = graph.count_status(TaskStatus::Failed);
            if failed_count > 10 {
                return Err(anyhow::anyhow!(
                    "Too many failed tasks ({}) — aborting",
                    failed_count
                ));
            }
        }
    }

    // Build summary
    let summary = {
        let ws = state.lock().await;
        AgentCompletedEvent {
            run_id: run_id.clone(),
            goal: ws.goal.clone(),
            files_created: ws.created_files.len(),
            files_modified: ws.modified_files.len(),
            actions_completed: ws.completed.len(),
            tasks_total: graph.nodes_with_status(TaskStatus::Finished).len()
                + graph.nodes_with_status(TaskStatus::Failed).len(),
            tasks_failed: graph.count_status(TaskStatus::Failed),
            errors: ws.diagnostics.len(),
            status: if graph.is_success() { "success".into() } else { "partial".into() },
        }
    };

    Ok(summary)
}

async fn state_available(state: &Arc<Mutex<WorldState>>) -> bool {
    state.try_lock().is_ok()
}
