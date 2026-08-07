// ── Background Intelligence Services (Phase 3) ─────────────────────────────
// Always-on services that keep a workspace's intelligence fresh:
//
//   Indexer   — scans the workspace, populates `file_index` + graph, and
//               watches for filesystem changes to re-index incrementally.
//   Git       — polls git status / branch and emits `git:changed`.
//   Builds    — watches build output dirs and emits `builds:changed`.
//
// Status of each service is tracked and emitted as
//   indexer:status / git:status / builds:status  → { status }
// Activity is appended to the timeline via timeline_insert.
//
// Tauri events emitted:
//   indexer:status   { status: "starting"|"active"|"inactive"|"error" }
//   indexer:changed  { path, kind }
//   git:status       { status }
//   git:changed      { branch, changes }
//   builds:status    { status }
//   builds:changed   { active, dirs }
//   timeline:event   { TimelineEvent }

use crate::agent::world_state::{content_hash, extract_symbols};
use crate::db::{queries, DbPool};
use crate::db::models::TimelineEvent;
use notify::{Event as NotifyEvent, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

// ── Service Status ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Starting,
    Active,
    Inactive,
    Error,
}

impl ServiceStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Starting => "starting",
            Self::Active => "active",
            Self::Inactive => "inactive",
            Self::Error => "error",
        }
    }
}

// ── Service Manager ──────────────────────────────────────────────────────
// Tracks per-workspace service status. Emits status events on change.

#[derive(Default)]
pub struct ServicesManager {
    statuses: Arc<Mutex<std::collections::HashMap<String, ServiceStatus>>>,
    watchers: Arc<Mutex<Vec<notify::RecommendedWatcher>>>,
}

impl ServicesManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_status(&self, app: &AppHandle, service: &str, status: ServiceStatus) {
        let event_name = match service {
            "indexer" => "indexer:status",
            "git" => "git:status",
            "builds" => "builds:status",
            _ => return,
        };
        {
            let mut map = self.statuses.lock().unwrap();
            let prev = map.get(service).cloned().unwrap_or(ServiceStatus::Inactive);
            if prev == status {
                return;
            }
            map.insert(service.to_string(), status.clone());
        }
        let _ = app.emit(event_name, serde_json::json!({ "status": status.as_str() }));
    }

    pub fn get_status(&self, service: &str) -> ServiceStatus {
        self.statuses
            .lock()
            .unwrap()
            .get(service)
            .cloned()
            .unwrap_or(ServiceStatus::Inactive)
    }

    pub fn all_statuses(&self) -> serde_json::Value {
        let map = self.statuses.lock().unwrap();
        let mut out = serde_json::Map::new();
        for (k, v) in map.iter() {
            out.insert(k.clone(), serde_json::json!(v.as_str()));
        }
        serde_json::Value::Object(out)
    }

    fn keep_watcher(&self, watcher: notify::RecommendedWatcher) {
        self.watchers.lock().unwrap().push(watcher);
    }
}

// ── Timeline helper ─────────────────────────────────────────────────────

fn emit_timeline(
    app: &AppHandle,
    db: &DbPool,
    workspace_id: &str,
    kind: &str,
    title: &str,
    description: &str,
) {
    let event = TimelineEvent::new(workspace_id, kind, title, description);
    let _ = queries::timeline_insert(db, &event);
    let _ = app.emit("timeline:event", &event);
}

// ── Indexer Service ─────────────────────────────────────────────────────

/// Start background services for a workspace. Fire-and-forget.
pub fn start_for_workspace(
    app: AppHandle,
    db: DbPool,
    manager: Arc<ServicesManager>,
    workspace_id: String,
    workspace_path: String,
) {
    let app_i = app.clone();
    let db_i = db.clone();
    let m_i = manager.clone();
    let ws_id = workspace_id.clone();
    let ws_path = workspace_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        run_indexer(&app_i, &db_i, &m_i, &ws_id, &ws_path);
    });

    let app_g = app.clone();
    let db_g = db.clone();
    let m_g = manager.clone();
    let ws_id_g = workspace_id.clone();
    let ws_path_g = workspace_path.clone();
    tauri::async_runtime::spawn(async move {
        run_git_watcher(&app_g, &db_g, &m_g, &ws_id_g, &ws_path_g).await;
    });

    let app_b = app.clone();
    let m_b = manager.clone();
    let ws_id_b = workspace_id.clone();
    let ws_path_b = workspace_path.clone();
    tauri::async_runtime::spawn(async move {
        run_builds_watcher(&app_b, &m_b, &ws_id_b, &ws_path_b).await;
    });
}

/// Indexer: initial full scan, then incremental re-index on fs changes.
fn run_indexer(app: &AppHandle, db: &DbPool, manager: &ServicesManager, workspace_id: &str, workspace_path: &str) {
    manager.set_status(app, "indexer", ServiceStatus::Starting);

    // Initial full scan.
    match crate::graph::scan_workspace(db, workspace_id, workspace_path) {
        Ok(snap) => {
            tracing::info!(
                "Indexer: scanned {} files for workspace {}",
                snap.scanned_files, workspace_id
            );
            emit_timeline(
                app, db, workspace_id,
                "indexer",
                "Index complete",
                &format!("Indexed {} files in the workspace graph.", snap.scanned_files),
            );
        }
        Err(e) => {
            tracing::error!("Indexer initial scan failed: {}", e);
            manager.set_status(app, "indexer", ServiceStatus::Error);
            return;
        }
    }

    // Watch for changes and re-index incrementally.
    let path = workspace_path.to_string();
    let ws_id = workspace_id.to_string();
    let app_clone = app.clone();
    let db_clone = db.clone();
    let (tx, rx) = std::sync::mpsc::channel::<PathBuf>();
    let tx_clone = tx.clone();

    let mut watcher = match notify::recommended_watcher(move |res: notify::Result<NotifyEvent>| {
        if let Ok(event) = res {
            for p in event.paths {
                let _ = tx_clone.send(p);
            }
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            tracing::error!("Indexer watcher failed to start: {}", e);
            manager.set_status(app, "indexer", ServiceStatus::Error);
            return;
        }
    };

    if let Err(e) = watcher.watch(Path::new(&path), RecursiveMode::Recursive) {
        tracing::error!("Indexer watcher failed to watch {}: {}", path, e);
        manager.set_status(app, "indexer", ServiceStatus::Error);
        return;
    }
    manager.keep_watcher(watcher);
    manager.set_status(app, "indexer", ServiceStatus::Active);

    let mut pending: HashSet<PathBuf> = HashSet::new();
    loop {
        // Wait for an event, then drain with a short debounce window.
        match rx.recv_timeout(Duration::from_millis(2000)) {
            Ok(p) => pending.insert(p),
            Err(_) => {
                // Timeout — flush anything accumulated.
                if pending.is_empty() {
                    continue;
                }
                true
            }
        };

        while let Ok(p) = rx.try_recv() {
            pending.insert(p);
        }
        std::thread::sleep(Duration::from_millis(150));

        if pending.is_empty() {
            continue;
        }

        let batch: Vec<PathBuf> = pending.drain().collect();
        for p in &batch {
            reindex_path(&db_clone, &ws_id, &path, p);
        }
        let _ = app_clone.emit(
            "indexer:changed",
            serde_json::json!({ "path": batch[0].to_string_lossy().to_string(), "kind": "modify" }),
        );
    }
}

/// Re-index a single changed path (incremental).
fn reindex_path(db: &DbPool, workspace_id: &str, workspace_root: &str, abs_path: &PathBuf) {
    let rel = match abs_path.strip_prefix(Path::new(workspace_root)) {
        Ok(r) => r.to_string_lossy().to_string().replace('\\', "/"),
        Err(_) => return,
    };
    if rel.is_empty() || is_ignored(&rel) {
        return;
    }

    if !abs_path.exists() {
        let _ = queries::file_index_delete(db, workspace_id, &rel);
        return;
    }
    if abs_path.is_dir() {
        return;
    }

    let content = std::fs::read_to_string(abs_path).unwrap_or_default();
    let ext = abs_path
        .extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase())
        .unwrap_or_default();
    let (symbols, imports, functions) = extract_symbols(&content, &ext);
    let hash = content_hash(&content);
    let summary = crate::agent::world_state::generate_file_summary(&rel, &symbols, &imports, &functions);
    let _ = queries::file_index_upsert(
        db, workspace_id, &rel, &hash,
        &symbols, &imports, &functions, &summary,
        content.len() as i64,
    );
}

fn is_ignored(rel: &str) -> bool {
    let first = rel.split('/').next().unwrap_or("");
    matches!(
        first,
        "node_modules" | ".git" | "target" | "dist" | "build" | "tmp" | "out" | ".next"
    )
}

// ── Git Watcher ─────────────────────────────────────────────────────────

struct GitStatus {
    branch: String,
    changes: usize,
}

fn git_status(dir: &str) -> Option<GitStatus> {
    let branch = run_git(dir, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    let porcelain = run_git(dir, &["status", "--porcelain"])?;
    let changes = porcelain.lines().filter(|l| !l.trim().is_empty()).count();
    Some(GitStatus {
        branch: branch.trim().to_string(),
        changes,
    })
}

fn run_git(dir: &str, args: &[&str]) -> Option<String> {
    let out = std::process::Command::new("git")
        .current_dir(dir)
        .args(args)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&out.stdout).to_string())
}

async fn run_git_watcher(
    app: &AppHandle,
    db: &DbPool,
    manager: &ServicesManager,
    workspace_id: &str,
    workspace_path: &str,
) {
    let mut last: Option<GitStatus> = None;
    loop {
        let is_repo = Path::new(workspace_path).join(".git").exists();
        if !is_repo {
            manager.set_status(app, "git", ServiceStatus::Inactive);
            last = None;
        } else if let Some(status) = git_status(workspace_path) {
            let changed = last.as_ref().map(|l| {
                l.branch != status.branch || l.changes != status.changes
            }).unwrap_or(false);
            manager.set_status(app, "git", ServiceStatus::Active);
            if changed {
                let _ = app.emit(
                    "git:changed",
                    serde_json::json!({
                        "branch": status.branch,
                        "changes": status.changes,
                    }),
                );
                emit_timeline(
                    app,
                    db,
                    workspace_id,
                    "git",
                    "Git state changed",
                    &format!("Branch {} — {} pending change(s).", status.branch, status.changes),
                );
            }
            last = Some(status);
        } else {
            manager.set_status(app, "git", ServiceStatus::Inactive);
            last = None;
        }
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

// ── Builds Watcher ──────────────────────────────────────────────────────

const BUILD_DIRS: [&str; 5] = ["target", "dist", ".next", "build", "out"];

async fn run_builds_watcher(
    app: &AppHandle,
    manager: &ServicesManager,
    _workspace_id: &str,
    workspace_path: &str,
) {
    let mut last_active = false;
    loop {
        let active = build_activity(workspace_path);
        manager.set_status(
            app,
            "builds",
            if active { ServiceStatus::Active } else { ServiceStatus::Inactive },
        );
        if active != last_active {
            let _ = app.emit(
                "builds:changed",
                serde_json::json!({ "active": active, "dirs": BUILD_DIRS }),
            );
        }
        last_active = active;
        tokio::time::sleep(Duration::from_secs(10)).await;
    }
}

/// Heuristic: a build is in progress if any build output dir was modified
/// within the last 60 seconds.
fn build_activity(workspace_path: &str) -> bool {
    let now = std::time::SystemTime::now();
    for dir in BUILD_DIRS {
        let p = Path::new(workspace_path).join(dir);
        if !p.exists() {
            continue;
        }
        if let Ok(meta) = p.metadata() {
            if let Ok(modified) = meta.modified() {
                if let Ok(elapsed) = now.duration_since(modified) {
                    if elapsed.as_secs() < 60 {
                        return true;
                    }
                }
            }
        }
    }
    false
}
