// ── DB Migrations ─────────────────────────────────────────────────────────
// Runs all DDL statements in order. Idempotent (IF NOT EXISTS everywhere).

use anyhow::Result;
use rusqlite::Connection;

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    seed_defaults(conn)?;
    Ok(())
}

fn seed_defaults(conn: &Connection) -> Result<()> {
    // Ensure default workspace exists
    conn.execute(
        "INSERT OR IGNORE INTO workspaces (id, name) VALUES ('default', 'My Workspace')",
        [],
    )?;
    // Ensure default project exists
    conn.execute(
        "INSERT OR IGNORE INTO projects (id, workspace_id, name, color) VALUES ('default', 'default', 'My Notes', '#6366f1')",
        [],
    )?;
    Ok(())
}

const SCHEMA: &str = r#"
-- ── Workspaces ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    path        TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Projects ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    name         TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    color        TEXT NOT NULL DEFAULT '#6366f1',
    archived     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- ── Notes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    project_id   TEXT NOT NULL DEFAULT 'default',
    title        TEXT NOT NULL DEFAULT 'Untitled Note',
    content      TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '[]',
    summary      TEXT NOT NULL DEFAULT '',
    pinned       INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)   REFERENCES projects(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_project   ON notes(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated   ON notes(updated_at DESC);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title, content, tags,
    content=notes, content_rowid=rowid,
    tokenize='unicode61'
);

-- ── Note Relations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_relations (
    id             TEXT PRIMARY KEY,
    source_note_id TEXT NOT NULL,
    target_note_id TEXT NOT NULL,
    relation_type  TEXT NOT NULL DEFAULT 'related',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE,
    UNIQUE(source_note_id, target_note_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_note_relations_source ON note_relations(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_relations_target ON note_relations(target_note_id);

-- ── Note Attachments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS note_attachments (
    id         TEXT PRIMARY KEY,
    note_id    TEXT NOT NULL,
    filename   TEXT NOT NULL,
    mime_type  TEXT NOT NULL DEFAULT '',
    size       INTEGER NOT NULL DEFAULT 0,
    path       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attachments_note ON note_attachments(note_id);

-- ── Files ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    project_id   TEXT NOT NULL DEFAULT 'default',
    path         TEXT NOT NULL,
    filename     TEXT NOT NULL,
    mime_type    TEXT NOT NULL DEFAULT '',
    size         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)   REFERENCES projects(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

-- ── Tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    project_id   TEXT NOT NULL DEFAULT '',
    note_id      TEXT,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'pending',
    priority     TEXT NOT NULL DEFAULT 'medium',
    due_date     TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);

-- ── AI Cache ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_cache (
    id         TEXT PRIMARY KEY,
    note_id    TEXT NOT NULL,
    type       TEXT NOT NULL,
    content    TEXT NOT NULL,
    model_used TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_note ON ai_cache(note_id, type);

-- ── Chat Sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    project_id   TEXT NOT NULL DEFAULT 'default',
    title        TEXT NOT NULL DEFAULT 'New Chat',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id)   REFERENCES projects(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace ON chat_sessions(workspace_id);

-- ── Chat Messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    metadata   TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ── Build Logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS build_logs (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    project_id   TEXT NOT NULL DEFAULT 'default',
    goal         TEXT NOT NULL,
    steps_json   TEXT NOT NULL,
    outcome      TEXT NOT NULL,
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ── Embeddings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embeddings (
    id          TEXT PRIMARY KEY,
    note_id     TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text  TEXT NOT NULL,
    vector_blob BLOB,
    content_hash TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_embeddings_note ON embeddings(note_id);

-- ── App Config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;
