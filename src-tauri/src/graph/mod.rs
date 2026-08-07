// ── Workspace Graph Engine (Phase 2) ────────────────────────────────────────
// Scans a workspace directory, builds a dependency graph of directories,
// files, and symbols, and persists it to SQLite. The frontend queries the
// persisted snapshot via graph_query_cmd.

use crate::agent::world_state::{collect_source_files, extract_symbols};
use crate::db::{queries, models::GraphNode, models::GraphEdge, models::GraphSnapshot, DbPool};
use anyhow::Result;
use std::collections::HashMap;
use std::collections::HashSet;
use std::path::Path;
use std::hash::{Hash, Hasher};

pub const NODE_FILE: &str = "file";
pub const NODE_DIRECTORY: &str = "directory";
pub const NODE_SYMBOL: &str = "symbol";

pub const EDGE_CONTAINS: &str = "contains";
pub const EDGE_DEFINES: &str = "defines";
pub const EDGE_IMPORTS: &str = "imports";

/// Languages we treat as source code and try to extract symbols from.
fn language_for_ext(ext: &str) -> String {
    match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "hpp" => "cpp",
        "rb" => "ruby",
        _ => "text",
    }
    .to_string()
}

/// Deterministic node id derived from workspace + identity so re-scans are stable.
fn node_id(workspace_id: &str, parts: &[&str]) -> String {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    workspace_id.hash(&mut h);
    for p in parts {
        p.hash(&mut h);
    }
    format!("n_{:016x}", h.finish())
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}

/// Scan a workspace directory and persist its graph. Returns the snapshot.
pub fn scan_workspace(pool: &DbPool, workspace_id: &str, workspace_path: &str) -> Result<GraphSnapshot> {
    let files = collect_source_files(workspace_path);
    let workspace_id = workspace_id.to_string();

    let mut nodes: Vec<GraphNode> = Vec::new();
    let mut edges: Vec<GraphEdge> = Vec::new();

    // ── Build directory nodes first (parent chain for every file) ─────────
    let mut dir_ids: HashMap<String, String> = HashMap::new(); // rel_dir -> node id
    let mut dir_parents: HashMap<String, Option<String>> = HashMap::new(); // rel_dir -> parent rel_dir
    {
        let mut all_dirs: HashSet<String> = HashSet::new();
        for rel in &files {
            if let Some(parent) = Path::new(rel).parent() {
                let mut chain: Vec<String> = Vec::new();
                let mut cur = parent;
                loop {
                    let s = cur.to_string_lossy().to_string();
                    chain.push(s);
                    match cur.parent() {
                        Some(p) if !p.as_os_str().is_empty() => cur = p,
                        _ => break,
                    }
                }
                chain.reverse();
                for (i, d) in chain.iter().enumerate() {
                    all_dirs.insert(d.clone());
                    dir_parents.insert(
                        d.clone(),
                        if i > 0 { Some(chain[i - 1].clone()) } else { None },
                    );
                }
            }
        }
        for d in all_dirs {
            let id = node_id(&workspace_id, &[NODE_DIRECTORY, &d]);
            let name = Path::new(&d)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_else(|| d.clone());
            dir_ids.insert(d.clone(), id.clone());
            nodes.push(GraphNode {
                id,
                workspace_id: workspace_id.clone(),
                node_type: NODE_DIRECTORY.to_string(),
                name,
                path: d,
                language: String::new(),
                symbol_kind: String::new(),
                size: 0,
                created_at: now_str(),
                updated_at: now_str(),
            });
        }
    }

    // ── Build file + symbol nodes, and edges ───────────────────────────────
    let mut file_ids: HashMap<String, String> = HashMap::new(); // rel path -> node id
    let mut import_map: HashMap<String, Vec<String>> = HashMap::new(); // rel path -> import lines

    for rel in &files {
        let full = Path::new(workspace_path).join(rel);
        let ext = full
            .extension()
            .map(|e| e.to_string_lossy().to_string().to_lowercase())
            .unwrap_or_default();

        let content = std::fs::read_to_string(&full).unwrap_or_default();
        let (symbols, imports, functions) = extract_symbols(&content, &ext);

        let file_id = node_id(&workspace_id, &[NODE_FILE, rel]);
        file_ids.insert(rel.clone(), file_id.clone());
        let name = full
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| rel.clone());

        nodes.push(GraphNode {
            id: file_id.clone(),
            workspace_id: workspace_id.clone(),
            node_type: NODE_FILE.to_string(),
            name,
            path: rel.clone(),
            language: language_for_ext(&ext),
            symbol_kind: String::new(),
            size: content.len() as i64,
            created_at: now_str(),
            updated_at: now_str(),
        });

        // Keep the file_index table in sync (Phase 3: background indexer).
        {
            let hash = crate::agent::world_state::content_hash(&content);
            let summary = crate::agent::world_state::generate_file_summary(
                rel, &symbols, &imports, &functions,
            );
            let _ = queries::file_index_upsert(
                pool, &workspace_id, rel, &hash,
                &symbols, &imports, &functions, &summary,
                content.len() as i64,
            );
        }

        // contains: nearest directory -> file
        if let Some(parent) = Path::new(rel).parent() {
            let parent_str = parent.to_string_lossy().to_string();
            if let Some(dir_id) = dir_ids.get(&parent_str) {
                edges.push(GraphEdge::new(
                    &workspace_id,
                    dir_id.clone(),
                    file_id.clone(),
                    EDGE_CONTAINS,
                ));
            }
        }

        // defines: file -> symbol
        for sym in &symbols {
            let kind = sym
                .split_whitespace()
                .next()
                .unwrap_or("symbol")
                .to_string();
            let sym_id = node_id(&workspace_id, &[NODE_SYMBOL, rel, sym]);
            nodes.push(GraphNode {
                id: sym_id.clone(),
                workspace_id: workspace_id.clone(),
                node_type: NODE_SYMBOL.to_string(),
                name: sym.clone(),
                path: rel.clone(),
                language: language_for_ext(&ext),
                symbol_kind: kind,
                size: 0,
                created_at: now_str(),
                updated_at: now_str(),
            });
            edges.push(GraphEdge::new(
                &workspace_id,
                file_id.clone(),
                sym_id,
                EDGE_DEFINES,
            ));
        }

        import_map.insert(rel.clone(), imports);
    }

    // ── Resolve imports to local files (best-effort) ──────────────────────
    for (rel, import_lines) in &import_map {
        let source_id = file_ids.get(rel).cloned().unwrap_or_default();
        if source_id.is_empty() {
            continue;
        }
        for line in import_lines {
            if let Some(target) = resolve_import(line, rel, &file_ids) {
                let target_id = file_ids.get(&target).cloned().unwrap_or_default();
                if !target_id.is_empty() && target_id != source_id {
                    edges.push(GraphEdge::new(
                        &workspace_id,
                        source_id.clone(),
                        target_id,
                        EDGE_IMPORTS,
                    ));
                }
            }
        }
    }

    // ── contains: directory hierarchy (dir -> subdir) ─────────────────────
    for (dir, parent) in &dir_parents {
        if let Some(p) = parent {
            if let (Some(did), Some(pid)) = (dir_ids.get(dir), dir_ids.get(p)) {
                edges.push(GraphEdge::new(
                    &workspace_id,
                    pid.clone(),
                    did.clone(),
                    EDGE_CONTAINS,
                ));
            }
        }
    }

    // ── Persist (replace previous graph for this workspace) ───────────────
    queries::graph_clear_workspace(pool, &workspace_id)?;
    queries::graph_insert_nodes(pool, &nodes)?;
    queries::graph_insert_edges(pool, &edges)?;

    Ok(GraphSnapshot {
        workspace_id: workspace_id.clone(),
        scanned_files: files.len(),
        nodes,
        edges,
        scanned_at: now_str(),
    })
}

/// Best-effort resolution of an import statement to a local relative file path.
fn resolve_import(
    line: &str,
    from_rel: &str,
    file_ids: &HashMap<String, String>,
) -> Option<String> {
    // Pull out a module specifier from common import forms.
    let spec = extract_specifier(line)?;
    if spec.is_empty() {
        return None;
    }

    let from_dir = Path::new(from_rel)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut candidates: Vec<String> = Vec::new();

    // Relative specifiers resolve from the importing file's directory.
    let base = if spec.starts_with("./") || spec.starts_with("../") {
        let joined = Path::new(&from_dir).join(&spec);
        joined.to_string_lossy().to_string()
    } else if spec.starts_with("crate::") {
        // crate::foo::bar -> root foo/bar
        spec.replacen("crate::", "", 1).replace("::", "/")
    } else {
        // Bare module or package specifier — skip unless it maps to a root file.
        spec.replace('.', "/")
    };

    let normalized = base.trim_start_matches('/').to_string();
    if normalized.is_empty() {
        return None;
    }

    // Trim trailing module component that is really a symbol (e.g. `use foo::bar` where bar is a fn).
    // We generate several shapes: exact, +.ext, +/index.*, and drop trailing segments.
    let parts: Vec<&str> = normalized.split('/').collect();
    for drop in 0..parts.len() {
        let candidate = parts[..parts.len() - drop].join("/");
        candidates.push(candidate.clone());
        for ext in ["ts", "tsx", "js", "jsx", "rs", "py", "go", "rb", "mod.rs", "index.ts", "index.tsx", "index.js", "index.jsx", "index.py", "__init__.py"] {
            candidates.push(format!("{}.{}", candidate, ext));
        }
    }
    // Try directory index style: foo/bar -> foo/bar/index.* handled above.

    for cand in candidates {
        if file_ids.contains_key(&cand) {
            return Some(cand);
        }
    }
    None
}

/// Extract a module specifier from an import statement line.
fn extract_specifier(line: &str) -> Option<String> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }
    // TS/JS: `import { x } from './foo'` or `import './foo'`
    if line.starts_with("import ") {
        if let Some(from_idx) = line.find(" from ") {
            let spec = &line[from_idx + 6..];
            return Some(spec.trim().trim_matches(['\'', '"', ';']).to_string());
        }
        // bare side-effect import: import './foo'
        let rest = line.trim_start_matches("import ").trim();
        if rest.starts_with('.') || rest.starts_with('/') {
            return Some(rest.trim_matches(['\'', '"', ';']).to_string());
        }
        return None;
    }
    // Rust: `use crate::foo::bar;` / `use foo::bar;`
    if line.starts_with("use ") || line.starts_with("pub use ") {
        let mut spec = line
            .trim_start_matches("pub use ")
            .trim_start_matches("use ")
            .trim()
            .trim_end_matches(';')
            .to_string();
        // Strip `{ ... }` group imports: use foo::{A, B}
        if let Some(open) = spec.find('{') {
            spec.truncate(open);
            spec = spec.trim().trim_end_matches("::").to_string();
        }
        if spec.starts_with("crate") || spec.starts_with("std") || spec.starts_with("super") || spec.starts_with("self") {
            return Some(spec);
        }
        // Third-party crate import (`use anyhow::Result`) — skip.
        return None;
    }
    // Python: `import foo` / `from foo import bar`
    if line.starts_with("import ") {
        let spec = line.trim_start_matches("import ").trim();
        return Some(spec.split_whitespace().next()?.to_string());
    }
    if line.starts_with("from ") {
        let rest = line.trim_start_matches("from ").trim();
        let spec = rest.split_whitespace().next()?;
        return Some(spec.to_string());
    }
    None
}
