// ── Planner Role ──────────────────────────────────────────────────────────
// Receives WorldState as JSON (not markdown).
// Returns actions WITH content included (no separate codegen).
// One model. One decision.

use crate::agent::actions::{Action, ActionType};
use crate::agent::task_graph::TaskNode;
use crate::agent::world_state::WorldState;
use crate::llm::{complete, LlmMessage, LlmRequest, LlmSettings};
use anyhow::Result;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Mutex;

const SYSTEM_PROMPT: &str = r#"You are the Mission Planner of an autonomous coding agent.

You receive the current World State as JSON. Your job is to produce the next set of actions or task expansions.

Respond ONLY with a JSON object matching one of these formats:

## 1. Single Action
{
  "type": "action",
  "action_type": "WRITE_FILE" | "READ_FILE" | "EDIT_FILE" | "DELETE_FILE" | "LIST_DIRECTORY" | "RUN_COMMAND" | "SEARCH_CODE" | "THINK" | "DONE",
  "path": "<file path if applicable>",
  "content": "<COMPLETE file content for WRITE_FILE/EDIT_FILE — include EVERYTHING, no placeholders>",
  "command": "<shell command for RUN_COMMAND>",
  "cwd": "<working directory for command>",
  "query": "<search query for SEARCH_CODE>",
  "thought": "<your step-by-step reasoning>",
  "description": "<short summary of what this action does>"
}

## 2. Task Expansion (decompose high-level goal into subtasks)
{
  "type": "expand",
  "thought": "<your reasoning about how to decompose>",
  "tasks": [
    {
      "description": "<task description>",
      "priority": <0-100, higher = more urgent>,
      "dependencies": [<index of tasks this depends on, e.g. 0, 1>],
      "action": { <optional: include action directly if you already know the content> }
    }
  ]
}

## 3. Done
{
  "type": "done",
  "thought": "<final summary of what was accomplished>",
  "summary": "<brief summary of results>"
}

RULES:
- For WRITE_FILE and EDIT_FILE, include the COMPLETE file content in the "content" field
- Never leave TODOs or placeholders — implement everything
- Your "thought" field is stored as a persistent Thought and fed back in future context
- If you need more information before acting, use READ_FILE or SEARCH_CODE
- After creating/modifying files, run verification commands (build, test, lint)
- If the goal is complete, respond with type: "done"
- Never repeat the same failed action — check tool_history for what failed and why
"#;

pub struct Planner;

impl Planner {
    /// Plan the next action given the current world state.
    pub async fn plan_next(state: &Arc<Mutex<WorldState>>, settings: &LlmSettings) -> Result<Action> {
        let world_json = {
            let ws = state.lock().await;
            ws.to_planner_json()
        };

        let req = LlmRequest {
            messages: vec![
                LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
                LlmMessage { role: "user".into(), content: format!("Current World State (JSON):\n{}", world_json) },
            ],
            temperature: Some(0.2),
            max_tokens: Some(4096),
            json_mode: true,
            model: None,
            session_id: "planner".into(),
        };

        let raw = complete(req, settings).await?;
        let parsed: PlannerResponse = serde_json::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("Planner returned invalid JSON: {} — raw: {}", e, raw))?;

        match parsed {
            PlannerResponse::Action(response) => {
                let action_type = match response.action_type.as_str() {
                    "WRITE_FILE"     => ActionType::WriteFile,
                    "READ_FILE"      => ActionType::ReadFile,
                    "EDIT_FILE"      => ActionType::EditFile,
                    "DELETE_FILE"    => ActionType::DeleteFile,
                    "LIST_DIRECTORY" => ActionType::ListDirectory,
                    "RUN_COMMAND"    => ActionType::RunCommand,
                    "SEARCH_CODE"    => ActionType::SearchCode,
                    "THINK"          => ActionType::Think,
                    "DONE"           => ActionType::Done,
                    other            => return Err(anyhow::anyhow!("Unknown action type: {}", other)),
                };

                let mut action = Action::new(action_type, response.description.unwrap_or_default());
                action.path    = response.path;
                action.content = response.content;
                action.command = response.command;
                action.cwd     = response.cwd;
                action.query   = response.query;
                action.thought = response.thought;

                Ok(action)
            }
            PlannerResponse::Expand(expand) => {
                // Record the planning thought
                {
                    let ws = state.lock().await;
                    let goal = ws.goal.clone();
                    drop(ws);
                    let mut ws = state.lock().await;
                    ws.record_thought(crate::agent::world_state::Thought {
                        goal,
                        reason: expand.thought.clone().unwrap_or_default(),
                        chosen_action: "expand".into(),
                        expected_result: format!("Expanding into {} tasks", expand.tasks.len()),
                        timestamp: now_str(),
                    });
                }

                // Return the first task's action if available, otherwise return a Think action
                if let Some(first_task) = expand.tasks.into_iter().next() {
                    if let Some(act) = first_task.action {
                        Ok(act.into_action())
                    } else {
                        Ok(Action::new(ActionType::Think, first_task.description))
                    }
                } else {
                    Ok(Action::new(ActionType::Think, "No tasks to expand — need to replan"))
                }
            }
            PlannerResponse::Done(done) => {
                let mut action = Action::done();
                action.thought = done.thought;
                Ok(action)
            }
        }
    }

    /// Expand a high-level task into subtasks.
    pub async fn expand_task(
        description: &str,
        state: &Arc<Mutex<WorldState>>,
        settings: &LlmSettings,
    ) -> Result<Vec<TaskNode>> {
        let world_json = {
            let ws = state.lock().await;
            ws.to_planner_json()
        };

        let prompt = format!(
            "I need to decompose the following task into subtasks:\n\n\
             Task: {}\n\n\
             Current World State:\n{}\n\n\
             Respond with a JSON task expansion as described in the system prompt.",
            description, world_json
        );

        let req = LlmRequest {
            messages: vec![
                LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
                LlmMessage { role: "user".into(), content: prompt },
            ],
            temperature: Some(0.2),
            max_tokens: Some(4096),
            json_mode: true,
            model: None,
            session_id: "planner_expand".into(),
        };

        let raw = complete(req, settings).await?;
        let parsed: PlannerResponse = serde_json::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("Planner expansion returned invalid JSON: {} — raw: {}", e, raw))?;

        match parsed {
            PlannerResponse::Expand(expand) => {
                let mut nodes: Vec<TaskNode> = vec![];
                for task_info in expand.tasks {
                    let mut node = TaskNode::new(task_info.description, task_info.priority);
                    if let Some(act) = task_info.action {
                        node.action = Some(act.into_action());
                    }
                    // Store dependency indices as placeholder strings
                    // (caller will resolve indices to task IDs)
                    for dep_idx in task_info.dependencies {
                        if dep_idx < nodes.len() {
                            node.dependencies.push(nodes[dep_idx].id.clone());
                        }
                    }
                    nodes.push(node);
                }
                Ok(nodes)
            }
            PlannerResponse::Action(act) => {
                let desc = act.description.clone().unwrap_or_default();
                let mut node = TaskNode::new(&desc, 50);
                node.action = Some(act.into_action());
                Ok(vec![node])
            }
            PlannerResponse::Done(_) => {
                Ok(vec![])
            }
        }
    }
}

// ── Response Parsing ────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum PlannerResponse {
    #[serde(rename = "action")]
    Action(ActionResponse),
    #[serde(rename = "expand")]
    Expand(ExpandResponse),
    #[serde(rename = "done")]
    Done(DoneResponse),
}

#[derive(Debug, Deserialize)]
struct ActionResponse {
    action_type: String,
    path: Option<String>,
    content: Option<String>,
    command: Option<String>,
    cwd: Option<String>,
    query: Option<String>,
    thought: Option<String>,
    description: Option<String>,
}

impl ActionResponse {
    fn into_action(self) -> Action {
        let action_type = match self.action_type.as_str() {
            "WRITE_FILE" => ActionType::WriteFile,
            "READ_FILE" => ActionType::ReadFile,
            "EDIT_FILE" => ActionType::EditFile,
            "DELETE_FILE" => ActionType::DeleteFile,
            "LIST_DIRECTORY" => ActionType::ListDirectory,
            "RUN_COMMAND" => ActionType::RunCommand,
            "SEARCH_CODE" => ActionType::SearchCode,
            "THINK" => ActionType::Think,
            "DONE" => ActionType::Done,
            _ => ActionType::Think,
        };
        let mut a = Action::new(action_type, self.description.unwrap_or_default());
        a.path = self.path;
        a.content = self.content;
        a.command = self.command;
        a.cwd = self.cwd;
        a.query = self.query;
        a.thought = self.thought;
        a
    }
}

#[derive(Debug, Deserialize)]
struct ExpandResponse {
    thought: Option<String>,
    tasks: Vec<TaskInfo>,
}

#[derive(Debug, Deserialize)]
struct TaskInfo {
    description: String,
    priority: i32,
    #[serde(default)]
    dependencies: Vec<usize>,
    action: Option<ActionResponse>,
}

#[derive(Debug, Deserialize)]
struct DoneResponse {
    thought: Option<String>,
    #[allow(dead_code)]
    summary: Option<String>,
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}
