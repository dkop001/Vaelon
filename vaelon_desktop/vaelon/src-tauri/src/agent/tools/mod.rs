// ── Tool Executor ─────────────────────────────────────────────────────────
// Executes agent actions against the real file system and shell.

use crate::agent::actions::{Action, ActionType, ToolResult};
use crate::db::DbPool;
use std::process::Command;

pub struct ToolExecutor {
    db: DbPool,
}

impl ToolExecutor {
    pub fn new(db: DbPool) -> Self {
        Self { db }
    }

    pub async fn execute(&self, action: &Action) -> ToolResult {
        match action.action_type {
            ActionType::WriteFile  => self.write_file(action).await,
            ActionType::ReadFile   => self.read_file(action).await,
            ActionType::EditFile   => self.write_file(action).await, // same as write
            ActionType::DeleteFile => self.delete_file(action).await,
            ActionType::ListDirectory => self.list_directory(action).await,
            ActionType::RunCommand => self.run_command(action).await,
            ActionType::SearchCode => self.search_code(action).await,
            ActionType::FetchUrl   => self.fetch_url(action).await,
            ActionType::Think      => {
                // Return the planner's actual reasoning so it lands in
                // RECENT OBSERVATIONS on the next build_context() call.
                let thought_content = action.thought
                    .as_deref()
                    .filter(|t| !t.is_empty())
                    .unwrap_or(&action.description)
                    .to_string();
                ToolResult { success: true, output: Some(thought_content), error: None, exit_code: None }
            }
            ActionType::Done       => ToolResult { success: true, output: Some("Done".into()), error: None, exit_code: Some(0) },
        }
    }

    async fn write_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided for WRITE_FILE"),
        };
        let content = action.content.as_deref().unwrap_or("");

        match crate::fs::write_file(path, content) {
            Ok(_) => ToolResult { success: true, output: Some(format!("Wrote {}", path)), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn read_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided for READ_FILE"),
        };

        match crate::fs::read_file(path) {
            Ok(content) => ToolResult { success: true, output: Some(content), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn delete_file(&self, action: &Action) -> ToolResult {
        let path = match &action.path {
            Some(p) => p,
            None => return err("No path provided for DELETE_FILE"),
        };

        match crate::fs::delete_file(path) {
            Ok(_) => ToolResult { success: true, output: Some(format!("Deleted {}", path)), error: None, exit_code: Some(0) },
            Err(e) => err(&e.to_string()),
        }
    }

    async fn list_directory(&self, action: &Action) -> ToolResult {
        let path = action.path.as_deref().unwrap_or(".");

        match crate::fs::list_dir(path) {
            Ok(entries) => {
                let names: Vec<String> = entries.iter().map(|e| {
                    if e.is_dir { format!("{}/", e.name) } else { e.name.clone() }
                }).collect();
                ToolResult {
                    success: true,
                    output: Some(names.join("\n")),
                    error: None,
                    exit_code: Some(0),
                }
            }
            Err(e) => err(&e.to_string()),
        }
    }

    async fn run_command(&self, action: &Action) -> ToolResult {
        let command = match &action.command {
            Some(c) => c.clone(),
            None => return err("No command provided for RUN_COMMAND"),
        };

        let cwd = action.cwd.clone().unwrap_or_else(|| ".".into());

        let output = tokio::task::spawn_blocking(move || {
            #[cfg(target_os = "windows")]
            let result = Command::new("cmd")
                .args(["/C", &command])
                .current_dir(&cwd)
                .output();

            #[cfg(not(target_os = "windows"))]
            let result = Command::new("sh")
                .args(["-c", &command])
                .current_dir(&cwd)
                .output();

            result
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
            None => return err("No query for SEARCH_CODE"),
        };
        // Use ripgrep if available, else fallback
        let output = tokio::task::spawn_blocking(move || {
            Command::new("rg")
                .args(["--json", "-e", &query, "."])
                .output()
                .or_else(|_| Command::new("grep").args(["-r", &query, "."]).output())
        }).await;

        match output {
            Ok(Ok(out)) => {
                let text = String::from_utf8_lossy(&out.stdout).to_string();
                ToolResult { success: true, output: Some(text), error: None, exit_code: Some(0) }
            }
            _ => err("Code search failed"),
        }
    }

    async fn fetch_url(&self, action: &Action) -> ToolResult {
        let url = match &action.url {
            Some(u) => u.clone(),
            None => return err("No URL for FETCH_URL"),
        };

        // SSRF protection: only allow http/https, no private IPs
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return err("Only http/https URLs are allowed");
        }
        if is_private_url(&url) {
            return err("Private/local network URLs are not allowed");
        }

        match reqwest::get(&url).await {
            Ok(resp) => {
                let text = resp.text().await.unwrap_or_default();
                ToolResult { success: true, output: Some(text), error: None, exit_code: Some(0) }
            }
            Err(e) => err(&e.to_string()),
        }
    }
}

fn err(msg: &str) -> ToolResult {
    ToolResult {
        success: false,
        output: None,
        error: Some(msg.to_string()),
        exit_code: Some(1),
    }
}

fn is_private_url(url: &str) -> bool {
    let private_patterns = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "10.", "192.168.", "172.16."];
    private_patterns.iter().any(|p| url.contains(p))
}
