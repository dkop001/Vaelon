// ── World State ──────────────────────────────────────────────────────────
// Persistent structured state for the agent runtime.
// Replaces the old build_context() text-based approach.
// Serializes to JSON for the planner. Nothing disappears.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Thought (persistent reasoning) ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thought {
    pub goal: String,
    pub reason: String,
    pub chosen_action: String,
    pub expected_result: String,
    pub timestamp: String,
}

// ── Unified Tool Call API ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub input: serde_json::Value,
    pub output: serde_json::Value,
    pub success: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
}

// ── Event Sourcing ──────────────────────────────────────────────────────
// Every mutation is recorded as an event. WorldState can be rebuilt.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AgentEvent {
    FileCreated { path: String, content_hash: String, timestamp: String },
    FileEdited { path: String, old_hash: String, new_hash: String, timestamp: String },
    CommandRan { command: String, cwd: String, exit_code: i32, stdout: String, stderr: String, timestamp: String },
    ToolExecuted { tool_call: ToolCall, timestamp: String },
    PlannerThought { thought: Thought, timestamp: String },
    TaskStatusChanged { task_id: String, old_status: String, new_status: String, timestamp: String },
    GoalUpdated { goal: String, timestamp: String },
}

// ── Terminal Session (first-class terminal) ─────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionRecord {
    pub command: String,
    pub cwd: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub timestamp: String,
}

// ── File Index ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub path: String,
    pub hash: String,
    pub symbols: Vec<String>,
    pub imports: Vec<String>,
    pub functions: Vec<String>,
    pub summary: String,
    pub last_modified: String,
    pub size: u64,
}

// ── Symbol Graph ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolLocation {
    pub path: String,
    pub line: usize,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolGraph {
    pub symbols: HashMap<String, Vec<SymbolLocation>>,
}

// ── World State ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldState {
    pub goal: String,
    pub workspace_path: String,
    pub directory_tree: Vec<String>,
    pub opened_files: Vec<String>,
    pub created_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub terminal_history: Vec<TerminalSessionRecord>,
    pub tool_history: Vec<ToolCall>,
    pub knowledge: HashMap<String, String>,
    pub todo: Vec<String>,
    pub completed: Vec<String>,
    pub failed: Vec<String>,
    pub thoughts: Vec<Thought>,
    pub diagnostics: Vec<String>,
    pub current_focus: String,
    pub file_index: HashMap<String, FileEntry>,
    pub symbol_graph: SymbolGraph,
    pub events: Vec<AgentEvent>,
}

impl WorldState {
    pub fn new(goal: String, workspace_path: String) -> Self {
        Self {
            goal,
            workspace_path: workspace_path.clone(),
            directory_tree: scan_directory_tree(&workspace_path),
            opened_files: vec![],
            created_files: vec![],
            modified_files: vec![],
            terminal_history: vec![],
            tool_history: vec![],
            knowledge: HashMap::new(),
            todo: vec![],
            completed: vec![],
            failed: vec![],
            thoughts: vec![],
            diagnostics: vec![],
            current_focus: String::new(),
            file_index: HashMap::new(),
            symbol_graph: SymbolGraph { symbols: HashMap::new() },
            events: vec![],
        }
    }

    /// Serialize to JSON for the planner.
    /// Only includes fields the planner needs to see.
    pub fn to_planner_json(&self) -> String {
        #[derive(Serialize)]
        struct PlannerPayload<'a> {
            goal: &'a str,
            workspace_path: &'a str,
            directory_tree: &'a [String],
            opened_files: &'a [String],
            created_files: &'a [String],
            modified_files: &'a [String],
            terminal_history: &'a [TerminalSessionRecord],
            tool_history: &'a [ToolCall],
            knowledge: &'a HashMap<String, String>,
            todo: &'a [String],
            completed: &'a [String],
            failed: &'a [String],
            thoughts: &'a [Thought],
            diagnostics: &'a [String],
            current_focus: &'a str,
            file_index: &'a HashMap<String, FileEntry>,
            symbol_graph: &'a SymbolGraph,
        }
        serde_json::to_string_pretty(&PlannerPayload {
            goal: &self.goal,
            workspace_path: &self.workspace_path,
            directory_tree: &self.directory_tree,
            opened_files: &self.opened_files,
            created_files: &self.created_files,
            modified_files: &self.modified_files,
            terminal_history: &self.terminal_history,
            tool_history: &self.tool_history,
            knowledge: &self.knowledge,
            todo: &self.todo,
            completed: &self.completed,
            failed: &self.failed,
            thoughts: &self.thoughts,
            diagnostics: &self.diagnostics,
            current_focus: &self.current_focus,
            file_index: &self.file_index,
            symbol_graph: &self.symbol_graph,
        }).unwrap_or_default()
    }

    /// Record a tool execution in history.
    pub fn record_tool_call(&mut self, call: ToolCall) {
        self.tool_history.push(call);
    }

    /// Record a terminal session.
    pub fn record_terminal(&mut self, session: TerminalSessionRecord) {
        let exit_code = session.exit_code;
        let command = session.command.clone();
        let cwd = session.cwd.clone();
        self.terminal_history.push(session);
        if exit_code != 0 {
            self.diagnostics.push(format!(
                "Command failed (exit {}): `{}` in {}",
                exit_code, command, cwd
            ));
        }
    }

    /// Record a thought.
    pub fn record_thought(&mut self, thought: Thought) {
        self.thoughts.push(thought);
    }

    /// Record a file creation.
    pub fn record_file_created(&mut self, path: String, hash: String) {
        if !self.created_files.contains(&path) {
            self.created_files.push(path.clone());
        }
        self.file_index.insert(path.clone(), FileEntry {
            path,
            hash,
            symbols: vec![],
            imports: vec![],
            functions: vec![],
            summary: String::new(),
            last_modified: now_str(),
            size: 0,
        });
    }

    /// Record a file modification.
    pub fn record_file_modified(&mut self, path: String, hash: String) {
        if !self.modified_files.contains(&path) {
            self.modified_files.push(path.clone());
        }
        if let Some(entry) = self.file_index.get_mut(&path) {
            entry.hash = hash;
            entry.last_modified = now_str();
        }
    }

    /// Refresh the directory tree.
    pub fn refresh_directory_tree(&mut self) {
        self.directory_tree = scan_directory_tree(&self.workspace_path);
    }

    /// Push a diagnostic message.
    pub fn push_diagnostic(&mut self, msg: String) {
        self.diagnostics.push(msg);
    }

    /// Set current focus.
    pub fn set_focus(&mut self, focus: String) {
        self.current_focus = focus;
    }

    /// Record an event for event sourcing.
    pub fn push_event(&mut self, event: AgentEvent) {
        self.events.push(event);
    }
}

/// Scan workspace directory into a list of file paths.
fn scan_directory_tree(workspace_path: &str) -> Vec<String> {
    let mut files = vec![];
    let root = std::path::Path::new(workspace_path);
    walk(root, "", &mut files, 0);
    files
}

fn walk(dir: &std::path::Path, prefix: &str, files: &mut Vec<String>, depth: usize) {
    if depth > 4 { return; }
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut sorted: Vec<_> = entries.filter_map(std::result::Result::ok).collect();
        sorted.sort_by_key(|e| (!e.path().is_dir(), e.file_name()));
        for entry in sorted {
            let name = entry.file_name().to_string_lossy().to_string();
            if matches!(name.as_str(), "node_modules" | ".git" | "target" | "dist" | "build" | "package-lock.json" | "tmp") {
                continue;
            }
            let is_dir = entry.path().is_dir();
            files.push(format!("{}{}{}", prefix, name, if is_dir { "/" } else { "" }));
            if is_dir {
                walk(&entry.path(), &format!("{}  ", prefix), files, depth + 1);
            }
        }
    }
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Compute a content hash for a file (simple, non-cryptographic).
pub fn content_hash(content: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Compute hash from file path.
pub fn file_hash(path: &str) -> Option<String> {
    std::fs::read_to_string(path).ok().map(|c| content_hash(&c))
}

/// Extract symbols from source code (simple regex-based).
pub fn extract_symbols(content: &str, ext: &str) -> (Vec<String>, Vec<String>, Vec<String>) {
    let mut symbols = vec![];
    let mut imports = vec![];
    let mut functions = vec![];

    for line in content.lines() {
        let line = line.trim();
        match ext {
            "rs" => {
                if let Some(rest) = line.strip_prefix("pub fn ") {
                    if let Some(name) = rest.split('(').next() {
                        functions.push(name.trim().to_string());
                        symbols.push(format!("fn {}", name.trim()));
                    }
                } else if let Some(rest) = line.strip_prefix("fn ") {
                    if let Some(name) = rest.split('(').next() {
                        functions.push(name.trim().to_string());
                        symbols.push(format!("fn {}", name.trim()));
                    }
                } else if let Some(rest) = line.strip_prefix("pub struct ") {
                    if let Some(name) = rest.split(|c: char| c.is_whitespace() || c == '{' || c == ';').next() {
                        symbols.push(format!("struct {}", name));
                    }
                } else if let Some(rest) = line.strip_prefix("pub enum ") {
                    if let Some(name) = rest.split(|c: char| c.is_whitespace() || c == '{' || c == ';').next() {
                        symbols.push(format!("enum {}", name));
                    }
                } else if let Some(rest) = line.strip_prefix("pub trait ") {
                    if let Some(name) = rest.split(|c: char| c.is_whitespace() || c == '{' || c == ';').next() {
                        symbols.push(format!("trait {}", name));
                    }
                } else if line.starts_with("use ") || line.starts_with("pub use ") || line.starts_with("extern crate ") {
                    imports.push(line.to_string());
                } else if line.starts_with("mod ") && !line.contains('{') {
                    imports.push(format!("mod {}", line.trim_start_matches("mod ")));
                }
            }
            "ts" | "tsx" | "js" | "jsx" => {
                if let Some(rest) = line.strip_prefix("export function ") {
                    if let Some(name) = rest.split('(').next() {
                        functions.push(name.trim().to_string());
                        symbols.push(format!("function {}", name.trim()));
                    }
                } else if let Some(rest) = line.strip_prefix("function ") {
                    if let Some(name) = rest.split('(').next() {
                        functions.push(name.trim().to_string());
                        symbols.push(format!("function {}", name.trim()));
                    }
                } else if let Some(after) = line.strip_prefix("export const ") {
                    if let Some(name) = after.split(|c: char| c == ' ' || c == '=' || c == ':').next() {
                        symbols.push(format!("const {}", name.trim()));
                    }
                } else if let Some(rest) = line.strip_prefix("export class ") {
                    if let Some(name) = rest.split(|c: char| c.is_whitespace() || c == '{' || c == '{').next() {
                        symbols.push(format!("class {}", name));
                    }
                } else if let Some(rest) = line.strip_prefix("export interface ") {
                    if let Some(name) = rest.split(|c: char| c.is_whitespace() || c == '{' || c == '{').next() {
                        symbols.push(format!("interface {}", name));
                    }
                } else if let Some(rest) = line.strip_prefix("export type ") {
                    if let Some(name) = rest.split('=').next().map(|s| s.trim()) {
                        symbols.push(format!("type {}", name));
                    }
                } else if line.starts_with("import ") {
                    imports.push(line.to_string());
                }
            }
            _ => {}
        }
    }

    (symbols, imports, functions)
}
