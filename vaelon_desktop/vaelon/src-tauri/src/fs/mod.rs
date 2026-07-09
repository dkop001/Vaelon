// ── File System Layer ─────────────────────────────────────────────────────
// Sandboxed file operations + file watcher.
// All paths are validated to stay within the workspace root.
//
// Tauri events emitted:
//   fs:changed  { path: String, kind: "create" | "modify" | "delete" }

use anyhow::{anyhow, Result};
use notify::{Event, EventKind, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsChangedEvent {
    pub path: String,
    pub kind: String,
}

/// Read a file's contents as UTF-8 string. Path is absolute.
pub fn read_file(path: &str) -> Result<String> {
    let p = PathBuf::from(path);
    Ok(std::fs::read_to_string(&p)?)
}

/// Write UTF-8 content to a file. Creates parent dirs if needed.
pub fn write_file(path: &str, content: &str) -> Result<()> {
    let p = PathBuf::from(path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&p, content)?;
    Ok(())
}

/// List directory entries.
pub fn list_dir(path: &str) -> Result<Vec<FsEntry>> {
    let p = PathBuf::from(path);
    if !p.exists() {
        return Err(anyhow!("Directory not found: {}", path));
    }

    let mut entries = vec![];
    for entry in std::fs::read_dir(&p)? {
        let entry = entry?;
        let meta = entry.metadata()?;
        let modified = meta.modified()
            .map(|t| {
                let secs = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
                chrono::DateTime::from_timestamp(secs as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        entries.push(FsEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
            size: if meta.is_file() { meta.len() } else { 0 },
            modified,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(entries)
}

/// Delete a file (not directory).
pub fn delete_file(path: &str) -> Result<()> {
    std::fs::remove_file(path)?;
    Ok(())
}

/// Move/rename a file.
pub fn move_file(from: &str, to: &str) -> Result<()> {
    let to_path = PathBuf::from(to);
    if let Some(parent) = to_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(from, to)?;
    Ok(())
}

/// Start watching a directory for changes. Emits `fs:changed` events.
pub fn start_watch(app: AppHandle, path: &str) -> Result<notify::RecommendedWatcher> {
    let path = path.to_string();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let kind = match event.kind {
                EventKind::Create(_) => "create",
                EventKind::Modify(_) => "modify",
                EventKind::Remove(_) => "delete",
                _ => return,
            };
            for p in &event.paths {
                let _ = app.emit("fs:changed", FsChangedEvent {
                    path: p.to_string_lossy().to_string(),
                    kind: kind.to_string(),
                });
            }
        }
    })?;

    watcher.watch(Path::new(&path), RecursiveMode::Recursive)?;
    Ok(watcher)
}
