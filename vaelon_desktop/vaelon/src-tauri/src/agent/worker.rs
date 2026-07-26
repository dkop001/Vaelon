// ── Worker ──────────────────────────────────────────────────────────────
// Owns execution. Planner only gives objectives.
// Worker decides: Need file → Read → Modify → Compile → Run → Fix → Repeat.
// Self-healing: failure → collect → diagnose → retry → verify → continue.

use crate::agent::actions::{Action, ActionType, ToolResult};
use crate::agent::world_state::{self, ToolCall, WorldState};
use crate::agent::task_graph::TaskNode;
use crate::fs;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

pub struct Worker;

impl Worker {
    pub fn new() -> Self {
        Self
    }

    /// Execute a task. Returns the result and updates world state.
    /// Worker handles the entire execution lifecycle including self-healing.
    pub async fn execute(
        &self,
        node: &TaskNode,
        state: &Arc<Mutex<WorldState>>,
    ) -> ToolResult {
        let action = match &node.action {
            Some(a) => a.clone(),
            None => {
                return ToolResult {
                    success: false,
                    output: None,
                    error: Some("Task has no action".into()),
                    exit_code: Some(1),
                };
            }
        };

        let mut result = self.execute_with_retry(&action, state, 0).await;

        // Self-healing loop: retry with increasing context
        let max_retries = 3;
        for attempt in 1..=max_retries {
            if result.success {
                break;
            }

            // Collect diagnostics
            let stderr = result.error.as_deref().unwrap_or("");
            let exit_code = result.exit_code.unwrap_or(-1);
            let _diff = collect_diff(&action);

            {
                let mut ws = state.lock().await;
                ws.push_diagnostic(format!(
                    "Retry {}/{} for `{}`: exit={}, error={}",
                    attempt, max_retries, action.description, exit_code,
                    stderr.chars().take(200).collect::<String>()
                ));
            }

            // Diagnose and fix
            let repair_actions = diagnose(&action, &result);
            let mut repaired = false;

            for repair in &repair_actions {
                let r = self.execute_tool(repair, state).await;
                if r.success {
                    repaired = true;
                }
                // Record repair attempt
                let mut ws = state.lock().await;
                ws.record_tool_call(ToolCall {
                    name: format!("repair:{}", repair.action_type.as_ref()),
                    input: serde_json::json!({ "description": repair.description }),
                    output: serde_json::json!({ "success": r.success }),
                    success: r.success,
                    duration_ms: 0,
                    error: r.error.clone(),
                });
            }

            if repaired || attempt < max_retries {
                // Retry the original action
                result = self.execute_tool(&action, state).await;
                if result.success {
                    break;
                }
            }
        }

        result
    }

    /// Execute with retry logic for the action itself.
    async fn execute_with_retry(
        &self,
        action: &Action,
        state: &Arc<Mutex<WorldState>>,
        _depth: usize,
    ) -> ToolResult {
        self.execute_tool(action, state).await
    }

    /// Execute a single tool call and record it in world state.
    pub async fn execute_tool(
        &self,
        action: &Action,
        state: &Arc<Mutex<WorldState>>,
    ) -> ToolResult {
        let start = Instant::now();

        let result = match action.action_type {
            ActionType::WriteFile | ActionType::EditFile => {
                self.write_file(action).await
            }
            ActionType::ReadFile => {
                self.read_file(action).await
            }
            ActionType::DeleteFile => {
                self.delete_file(action).await
            }
            ActionType::ListDirectory => {
                self.list_directory(action).await
            }
            ActionType::RunCommand => {
                self.run_command(action).await
            }
            ActionType::SearchCode => {
                self.search_code(action).await
            }
            ActionType::Think => {
                ToolResult {
                    success: true,
                    output: action.thought.clone().or_else(|| Some(action.description.clone())),
                    error: None,
                    exit_code: Some(0),
                }
            }
            ActionType::Done => {
                ToolResult { success: true, output: Some("Done".into()), error: None, exit_code: Some(0) }
            }
        };

        let duration = start.elapsed().as_millis() as u64;

        // Record as a ToolCall in world state
        {
            let mut ws = state.lock().await;
            ws.record_tool_call(ToolCall {
                name: action.action_type.as_ref().to_string(),
                input: serde_json::json!({
                    "path": action.path,
                    "command": action.command,
                    "description": action.description,
                }),
                output: serde_json::json!({
                    "output": result.output,
                    "exit_code": result.exit_code,
                }),
                success: result.success,
                duration_ms: duration,
                error: result.error.clone(),
            });

            // Update file tracking
            if result.success {
                match action.action_type {
                    ActionType::WriteFile => {
                        if let Some(path) = &action.path {
                            let hash = world_state::file_hash(path).unwrap_or_default();
                            ws.record_file_created(path.clone(), hash);
                            ws.refresh_directory_tree();
                        }
                    }
                    ActionType::EditFile => {
                        if let Some(path) = &action.path {
                            let hash = world_state::file_hash(path).unwrap_or_default();
                            ws.record_file_modified(path.clone(), hash);
                        }
                    }
                    ActionType::RunCommand => {
                        // Record terminal session
                        let mut stdout = String::new();
                        let mut stderr = String::new();
                        if let Some(out) = &result.output {
                            stdout = out.clone();
                        }
                        if let Some(err) = &result.error {
                            stderr = err.clone();
                        }
                        ws.record_terminal(world_state::TerminalSessionRecord {
                            command: action.command.clone().unwrap_or_default(),
                            cwd: action.cwd.clone().unwrap_or_else(|| ".".into()),
                            exit_code: result.exit_code.unwrap_or(-1),
                            stdout,
                            stderr,
                            timestamp: now_str(),
                        });
                    }
                    _ => {}
                }
            }

            if !result.success {
                ws.push_diagnostic(format!(
                    "Action failed: {} — {}",
                    action.description,
                    result.error.as_deref().unwrap_or("unknown error")
                ));
            }
        }

        result
    }

    async fn write_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided"),
        };
        let content = action.content.as_deref().unwrap_or("");
        match fs::write_file(path, content) {
            Ok(_) => ToolResult { success: true, output: Some(format!("Wrote {}", path)), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn read_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided"),
        };
        match fs::read_file(path) {
            Ok(content) => ToolResult { success: true, output: Some(content), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn delete_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided"),
        };
        match fs::delete_file(path) {
            Ok(_) => ToolResult { success: true, output: Some(format!("Deleted {}", path)), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn list_directory(&self, action: &Action) -> ToolResult {
        let path = action.path.as_deref().unwrap_or(".");
        match fs::list_dir(path) {
            Ok(entries) => {
                let names: Vec<String> = entries.iter()
                    .map(|e| if e.is_dir { format!("{}/", e.name) } else { e.name.clone() })
                    .collect();
                ToolResult { success: true, output: Some(names.join("\n")), error: None, exit_code: Some(0) }
            }
            Err(e) => err(&e.to_string()),
        }
    }

    async fn run_command(&self, action: &Action) -> ToolResult {
        let command = match &action.command {
            Some(c) => c.clone(),
            None => return err("No command provided"),
        };
        let cwd = action.cwd.clone().unwrap_or_else(|| ".".into());

        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("cmd")
                .args(["/C", &command])
                .current_dir(&cwd)
                .output()
        }).await;

        match output {
            Ok(Ok(out)) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                let code = out.status.code().unwrap_or(-1);
                let success = code == 0;
                ToolResult {
                    success,
                    output: Some(if stdout.is_empty() { stderr.clone() } else { stdout }),
                    error: if success { None } else { Some(stderr) },
                    exit_code: Some(code),
                }
            }
            Ok(Err(e)) => err(&e.to_string()),
            Err(e) => err(&e.to_string()),
        }
    }

    async fn search_code(&self, action: &Action) -> ToolResult {
        let query = match &action.query {
            Some(q) => q.clone(),
            None => return err("No query for search"),
        };
        let output = tokio::task::spawn_blocking(move || {
            std::process::Command::new("rg")
                .args(["--json", "-e", &query, "."])
                .output()
                .or_else(|_| std::process::Command::new("grep").args(["-r", &query, "."]).output())
        }).await;

        match output {
            Ok(Ok(out)) => {
                let text = String::from_utf8_lossy(&out.stdout).to_string();
                ToolResult { success: true, output: Some(text), error: None, exit_code: Some(0) }
            }
            _ => err("Code search failed"),
        }
    }
}

// ── Diagnostics ─────────────────────────────────────────────────────────

/// Collect diff for a file action (simple: check if file changed).
fn collect_diff(action: &Action) -> String {
    if let Some(path) = &action.path {
        if let Ok(content) = std::fs::read_to_string(path) {
            let expected = action.content.as_deref().unwrap_or("");
            if content != expected {
                return format!("File {} differs from expected content", path);
            }
        }
    }
    String::new()
}

/// Diagnose a failure and generate repair actions.
fn diagnose(action: &Action, result: &ToolResult) -> Vec<Action> {
    let mut repairs = vec![];
    let error = result.error.as_deref().unwrap_or("");

    match action.action_type {
        ActionType::RunCommand => {
            if error.contains("Cannot find module") || error.contains("Module not found") {
                if let Some(module) = extract_module_name(error) {
                    repairs.push(Action::run_command(
                        format!("npm install {}", module),
                        action.cwd.clone(),
                        format!("Install missing module: {}", module),
                    ));
                }
            }
            if error.contains("command not found") || error.contains("is not recognized") {
                repairs.push(Action::think(format!(
                    "Command not found: {}. Need to install it or use an alternative.",
                    action.command.as_deref().unwrap_or("?")
                )));
            }
            if error.contains("Permission denied") || error.contains("EACCES") {
                repairs.push(Action::run_command(
                    format!("chmod +x {}", action.command.as_deref().unwrap_or(".")),
                    action.cwd.clone(),
                    "Fix permissions",
                ));
            }
        }
        ActionType::WriteFile | ActionType::EditFile => {
            if error.contains("No such file or directory") || error.contains("cannot find the path") {
                if let Some(path) = &action.path {
                    if let Some(parent) = std::path::Path::new(path).parent() {
                        repairs.push(Action::run_command(
                            format!("mkdir -p \"{}\"", parent.display()),
                            None,
                            format!("Create parent directories for {}", path),
                        ));
                    }
                }
            }
        }
        _ => {}
    }

    repairs
}

fn extract_module_name(error: &str) -> Option<String> {
    if let Some(start) = error.find("Cannot find module '") {
        let rest = &error[start + 20..];
        if let Some(end) = rest.find('\'') {
            return Some(rest[..end].to_string());
        }
    }
    None
}

fn err(msg: &str) -> ToolResult {
    ToolResult { success: false, output: None, error: Some(msg.to_string()), exit_code: Some(1) }
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}
