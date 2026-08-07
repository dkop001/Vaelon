// ── World State ──────────────────────────────────────────────────────────
// Persistent structured state for the agent runtime.
// Replaces the old build_context() text-based approach.
// Serializes to JSON for the planner. Nothing disappears.

use anyhow::Result;
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
    pub memory_context: String,
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
            memory_context: String::new(),
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
            memory_context: &'a str,
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
            memory_context: &self.memory_context,
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

    // ── Project Intelligence (PRD: memory over prompts) ─────────────────

    /// Index a single file: extract symbols/imports/functions and update
    /// the file_index plus the symbol graph.
    pub fn learn_from_file(&mut self, path: &str) -> Result<String> {
        let content = std::fs::read_to_string(path)?;
        let ext = std::path::Path::new(path)
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        let (symbols, imports, functions) = extract_symbols(&content, &ext);
        let summary = generate_file_summary(path, &symbols, &imports, &functions);
        let hash = content_hash(&content);
        self.file_index.insert(path.to_string(), FileEntry {
            path: path.to_string(),
            hash,
            symbols: symbols.clone(),
            imports,
            functions,
            summary: summary.clone(),
            last_modified: now_str(),
            size: content.len() as u64,
        });
        self.update_symbol_graph(path, &symbols);
        Ok(summary)
    }

    /// Index every source file in the workspace. Returns how many were read.
    pub fn index_workspace(&mut self) -> usize {
        let mut count = 0;
        for rel in collect_source_files(&self.workspace_path) {
            let full = std::path::Path::new(&self.workspace_path).join(&rel);
            if let Some(p) = full.to_str() {
                if self.learn_from_file(p).is_ok() {
                    count += 1;
                }
            }
        }
        count
    }

    /// Rebuild the symbol graph from a file's symbol list.
    fn update_symbol_graph(&mut self, path: &str, symbols: &[String]) {
        for symbol in symbols {
            let kind = symbol
                .split_whitespace()
                .next()
                .unwrap_or("symbol")
                .to_string();
            self.symbol_graph
                .symbols
                .entry(symbol.clone())
                .or_insert_with(Vec::new)
                .push(SymbolLocation {
                    path: path.to_string(),
                    line: 0,
                    kind,
                });
        }
    }

    /// Scan the whole workspace and store architectural knowledge.
    pub fn build_architectural_understanding(&mut self) {
        let files = collect_source_files(&self.workspace_path);
        let total = files.len();
        if total == 0 {
            return;
        }

        let mut ext_counts: HashMap<String, usize> = HashMap::new();
        let mut dir_counts: HashMap<String, usize> = HashMap::new();
        for f in &files {
            let ext = std::path::Path::new(f)
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_else(|| "none".to_string());
            *ext_counts.entry(ext).or_insert(0) += 1;
            let dir = std::path::Path::new(f)
                .parent()
                .map(|d| d.to_string_lossy().to_string())
                .unwrap_or_else(|| "/".to_string());
            *dir_counts.entry(dir).or_insert(0) += 1;
        }

        let mut ext_list: Vec<_> = ext_counts.into_iter().collect();
        ext_list.sort_by(|a, b| b.1.cmp(&a.1));
        let mut dir_list: Vec<_> = dir_counts.into_iter().collect();
        dir_list.sort_by(|a, b| b.1.cmp(&a.1));

        let arch = extract_architecture_patterns(&dir_list);

        self.knowledge.insert("project.total_files".into(), total.to_string());
        self.knowledge.insert("project.architecture".into(), arch);
        self.knowledge.insert(
            "project.top_extensions".into(),
            ext_list
                .iter()
                .take(5)
                .map(|(e, c)| format!("{}:{}", e, c))
                .collect::<Vec<_>>()
                .join(", "),
        );
        self.knowledge.insert(
            "project.top_directories".into(),
            dir_list
                .iter()
                .take(5)
                .map(|(d, c)| format!("{}:{}", d, c))
                .collect::<Vec<_>>()
                .join(", "),
        );
    }

    /// Generate a compact "project DNA" description of the workspace.
    pub fn generate_project_dna(&self) -> String {
        #[derive(Serialize)]
        struct Dna {
            workspace: String,
            total_files: String,
            total_symbols: usize,
            architecture: String,
            extensions: String,
            directories: String,
            hot_symbols: Vec<String>,
        }

        let mut syms: Vec<(String, usize)> = self
            .symbol_graph
            .symbols
            .iter()
            .map(|(s, locs)| (s.clone(), locs.len()))
            .collect();
        syms.sort_by(|a, b| b.1.cmp(&a.1));
        let hot_symbols: Vec<String> = syms.iter().take(5).map(|(s, _)| s.clone()).collect();
        let total_symbols: usize = self.file_index.values().map(|e| e.symbols.len()).sum();

        serde_json::to_string_pretty(&Dna {
            workspace: self.workspace_path.clone(),
            total_files: self
                .knowledge
                .get("project.total_files")
                .cloned()
                .unwrap_or_default(),
            total_symbols,
            architecture: self
                .knowledge
                .get("project.architecture")
                .cloned()
                .unwrap_or_default(),
            extensions: self
                .knowledge
                .get("project.top_extensions")
                .cloned()
                .unwrap_or_default(),
            directories: self
                .knowledge
                .get("project.top_directories")
                .cloned()
                .unwrap_or_default(),
            hot_symbols,
        })
        .unwrap_or_default()
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

/// Collect real relative source paths (excluding build dirs).
pub fn collect_source_files(workspace_path: &str) -> Vec<String> {
    let mut files = vec![];
    let root = std::path::Path::new(workspace_path);
    walk_source_files(root, root, &mut files, 0);
    files
}

fn walk_source_files(
    root: &std::path::Path,
    dir: &std::path::Path,
    files: &mut Vec<String>,
    depth: usize,
) {
    if depth > 6 {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.filter_map(std::result::Result::ok) {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if matches!(
                name.as_str(),
                "node_modules" | ".git" | "target" | "dist" | "build" | "tmp" | "out"
            ) {
                continue;
            }
            if path.is_dir() {
                walk_source_files(root, &path, files, depth + 1);
            } else if let Ok(rel) = path.strip_prefix(root) {
                files.push(rel.to_string_lossy().to_string());
            }
        }
    }
}

/// Heuristic: describe the project layout as flat or layered.
pub fn extract_architecture_patterns(dir_list: &[(String, usize)]) -> String {
    let max = dir_list.iter().map(|(_, c)| *c).max().unwrap_or(0);
    let mut layers: Vec<&String> = vec![];
    for (dir, count) in dir_list {
        if *count >= 5 && max > 0 && count * 2 >= max {
            layers.push(dir);
        }
    }
    if layers.is_empty() {
        "flat".to_string()
    } else {
        let names: Vec<&str> = layers.into_iter().map(|s| s.as_str()).collect();
        format!("layered ({}): {}", names.len(), names.join(", "))
    }
}

/// Simple human-readable summary of a file based on its extracted symbols.
pub fn generate_file_summary(
    path: &str,
    symbols: &[String],
    _imports: &[String],
    functions: &[String],
) -> String {
    let name = std::path::Path::new(path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    let mut parts = Vec::new();
    if let Some(first) = functions.first() {
        parts.push(format!("defines {}", first));
    } else if let Some(first) = symbols.first() {
        parts.push(format!("declares {}", first));
    }
    if !symbols.is_empty() {
        parts.push(format!("{} symbols", symbols.len()));
    }
    if parts.is_empty() {
        return format!("File `{}` — no significant symbols found.", name);
    }
    format!("File `{}`: {}", name, parts.join(", "))
}
