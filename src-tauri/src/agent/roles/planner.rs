// ── Planner Role ──────────────────────────────────────────────────────────
// Receives WorldState as JSON (not markdown).
// Returns actions WITH content included (no separate codegen).
// One model. One decision.
// 
// Background modes:
//   - initial_plan: Parse current workspace into actions (first run)
//   - recovery: Replan after a failure or deadlock
//   - incremental: Refine plan when workspace changes

use crate::agent::actions::{Action, ActionType};
use crate::agent::task_graph::TaskNode;
use crate::agent::world_state::WorldState;
use crate::llm::{complete, LlmMessage, LlmRequest, LlmSettings};
use anyhow::Result;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::Mutex;

const SYSTEM_PROMPT: &str = r#"You are the Mission Planner of an autonomous coding agent.

You receive the current World State as JSON. Your job is to produce the next set of actions.

IMPORTANT: Your response MUST be a valid JSON object with a "type" field.
The "type" field MUST be one of: "action", "expand", "done".
Your response MUST NOT contain any other text outside the JSON.

## Format 1: Single Action (use when you know exactly what to do)
{
  "type": "action",
  "action_type": "WRITE_FILE" | "READ_FILE" | "EDIT_FILE" | "DELETE_FILE" | "RUN_COMMAND" | "SEARCH_CODE" | "THINK" | "DONE",
  "path": "the file path",
  "content": "COMPLETE file content for WRITE_FILE/EDIT_FILE — every byte, no placeholders",
  "command": "shell command string for RUN_COMMAND",
  "cwd": "working directory for the command",
  "query": "search query for SEARCH_CODE",
  "thought": "your reasoning",
  "description": "short summary of this action"
}

## Format 2: Task Expansion (use when you need to decompose a goal into subtasks)
{
  "type": "expand",
  "thought": "your reasoning",
  "tasks": [
    {
      "description": "what this subtask does",
      "priority": 50,
      "dependencies": [],
      "action": {
        "action_type": "WRITE_FILE",
        "path": "src/main.py",
        "content": "print('hello')"
      }
    }
  ]
}

## Format 3: Done
{
  "type": "done",
  "thought": "summary of what was accomplished",
  "summary": "brief result"
}

RULES:
- Every WRITE_FILE action MUST include both "path" and "content" fields with real values
- Every EDIT_FILE action MUST include both "path" and "content" fields
- Every RUN_COMMAND action MUST include "command" and may include "cwd"
- Never repeat the same failed action — read tool_history and diagnostics to understand what went wrong
- If a WRITE_FILE failed because of a missing parent directory, first RUN_COMMAND to create it
- "thought" is stored permanently and re-shown in future context — use it for genuine reasoning
"#;

pub struct Planner;

impl Planner {
    /// Plan the next action given the current world state.
    pub async fn plan_next(state: &Arc<Mutex<WorldState>>, settings: &LlmSettings) -> Result<Action> {
        let (world_json, memory) = {
            let ws = state.lock().await;
            (ws.to_planner_json(), ws.memory_context.clone())
        };

        let memory_block = if memory.is_empty() {
            String::new()
        } else {
            format!("\n\nPERSISTENT PROJECT MEMORY (follow conventions you remember here):\n{}\n", memory)
        };

        let req = LlmRequest {
            messages: vec![
                LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
                LlmMessage { role: "user".into(), content: format!("Current World State (JSON):\n{}{}", world_json, memory_block) },
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
                        Ok(act.into_action_with_description(&first_task.description))
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
        let (world_json, memory) = {
            let ws = state.lock().await;
            (ws.to_planner_json(), ws.memory_context.clone())
        };

        let memory_block = if memory.is_empty() {
            String::new()
        } else {
            format!("\n\nPERSISTENT PROJECT MEMORY (follow conventions you remember here):\n{}\n", memory)
        };

        let prompt = format!(
            "I need to decompose the following task into subtasks:\n\n\
             Task: {}\n\n\
             Current World State:\n{}\n{}\n\n\
             Respond with a JSON task expansion as described in the system prompt.",
            description, world_json, memory_block
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
                    let desc = task_info.description.clone();
                    let mut node = TaskNode::new(task_info.description, task_info.priority);
                    if let Some(task_action) = task_info.action {
                        node.action = Some(task_action.into_action_with_description(&desc));
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
#[serde(untagged)]
enum TaskAction {
    Object(ActionResponse),
    Shorthand(String),
}

impl TaskAction {
    fn into_action_with_description(self, description: &str) -> Action {
        match self {
            TaskAction::Object(resp) => resp.into_action(),
            TaskAction::Shorthand(name) => {
                let is_file_op = matches!(name.to_uppercase().as_str(),
                    "WRITE_FILE" | "CREATE_FILE" | "CREATE" | "MAKE" |
                    "READ_FILE" | "READ" |
                    "EDIT_FILE" | "EDIT" | "UPDATE" | "MODIFY" |
                    "DELETE_FILE" | "DELETE" | "REMOVE");

                let action_type = match name.to_uppercase().as_str() {
                    "WRITE_FILE" | "CREATE_FILE" | "CREATE" | "MAKE" => ActionType::WriteFile,
                    "READ_FILE" | "READ" => ActionType::ReadFile,
                    "EDIT_FILE" | "EDIT" | "UPDATE" | "MODIFY" => ActionType::EditFile,
                    "DELETE_FILE" | "DELETE" | "REMOVE" => ActionType::DeleteFile,
                    "LIST_DIRECTORY" | "LIST" => ActionType::ListDirectory,
                    "RUN_COMMAND" | "RUN" | "EXEC" | "EXECUTE" | "SHELL" => ActionType::RunCommand,
                    "SEARCH_CODE" | "SEARCH" | "FIND" => ActionType::SearchCode,
                    "THINK" | "REASON" | "ANALYZE" => ActionType::Think,
                    "DONE" | "FINISH" | "COMPLETE" => ActionType::Done,
                    _ => ActionType::Think,
                };

                let mut action = Action::new(action_type, format!("Task: {}", name));

                if is_file_op {
                    if let Some(path) = extract_path_from_description(description) {
                        action.path = Some(path);
                    }
                }

                action
            }
        }
    }
}

/// Result of initial planning — either the agent is done, or contains a list of tasks to add to the graph.
#[derive(Debug)]
pub enum InitialPlan {
    /// The agent considers the goal already achieved
    Done(String),
    /// Subtasks to add as children of the root node
    Tasks(Vec<TaskNode>),
}

impl Planner {
    /// Populate the graph from the planner's full response (handles expand/action/done).
    /// Unlike `plan_next`, this preserves ALL subtasks from an expand response.
    pub async fn initial_plan(
        state: &Arc<Mutex<WorldState>>,
        settings: &LlmSettings,
    ) -> Result<InitialPlan> {
        let (world_json, memory) = {
            let ws = state.lock().await;
            (ws.to_planner_json(), ws.memory_context.clone())
        };

        let memory_block = if memory.is_empty() {
            String::new()
        } else {
            format!("\n\nPERSISTENT PROJECT MEMORY (follow conventions you remember here):\n{}\n", memory)
        };

        let req = LlmRequest {
            messages: vec![
                LlmMessage { role: "system".into(), content: SYSTEM_PROMPT.into() },
                LlmMessage { role: "user".into(), content: format!("Current World State (JSON):\n{}{}", world_json, memory_block) },
            ],
            temperature: Some(0.2),
            max_tokens: Some(4096),
            json_mode: true,
            model: None,
            session_id: "initial_plan".into(),
        };

        let raw = complete(req, settings).await?;
        let parsed: PlannerResponse = serde_json::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("Planner returned invalid JSON: {} — raw: {}", e, raw))?;

        match parsed {
            PlannerResponse::Done(done) => Ok(InitialPlan::Done(done.summary.unwrap_or_default())),
            PlannerResponse::Action(act) => {
                let mut node = TaskNode::new(&act.description.clone().unwrap_or_default(), 50);
                node.action = Some(act.into_action());
                Ok(InitialPlan::Tasks(vec![node]))
            }
            PlannerResponse::Expand(expand) => {
                let mut nodes: Vec<TaskNode> = vec![];
                for task_info in expand.tasks {
                    let desc = task_info.description.clone();
                    let mut node = TaskNode::new(task_info.description, task_info.priority);
                    if let Some(task_action) = task_info.action {
                        node.action = Some(task_action.into_action_with_description(&desc));
                    }
                    // Store dependency indices as placeholder strings
                    for dep_idx in task_info.dependencies {
                        if dep_idx < nodes.len() {
                            node.dependencies.push(nodes[dep_idx].id.clone());
                        }
                    }
                    nodes.push(node);
                }
                Ok(InitialPlan::Tasks(nodes))
            }
        }
    }
}

/// Try to extract a file path from a task description.
/// Looks for patterns like: "main.py", "src/main.py", "C:\path\to\file.py"
fn extract_path_from_description(desc: &str) -> Option<String> {
    // Try to find Windows absolute paths and Unix paths
    for word in desc.split_whitespace() {
        let clean = word.trim_matches(|c: char| c == '"' || c == '\'' || c == '`' || c == ',' || c == '.' || c == ')' || c == '(');
        let lower = clean.to_lowercase();
        // Match file extensions
        if lower.ends_with(".py") || lower.ends_with(".rs") || lower.ends_with(".ts")
            || lower.ends_with(".tsx") || lower.ends_with(".js") || lower.ends_with(".jsx")
            || lower.ends_with(".css") || lower.ends_with(".html") || lower.ends_with(".json")
            || lower.ends_with(".toml") || lower.ends_with(".md") || lower.ends_with(".txt")
            || lower.ends_with(".yml") || lower.ends_with(".yaml") || lower.ends_with(".env")
            || lower.ends_with(".gitignore")
        {
            return Some(clean.to_string());
        }
    }
    // Look for quoted filenames in the description
    if let Some(start) = desc.find('"') {
        if let Some(end) = desc[start+1..].find('"') {
            let path = &desc[start+1..start+1+end];
            if path.contains('.') || path.contains('\\') || path.contains('/') {
                return Some(path.to_string());
            }
        }
    }
    None
}

#[derive(Debug, Deserialize)]
struct TaskInfo {
    description: String,
    priority: i32,
    #[serde(default)]
    dependencies: Vec<usize>,
    action: Option<TaskAction>,
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
