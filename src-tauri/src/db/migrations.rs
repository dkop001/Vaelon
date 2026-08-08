// ── DB Migrations ─────────────────────────────────────────────────────────
// Runs all DDL statements in order. Idempotent (IF NOT EXISTS everywhere).

use anyhow::Result;
use rusqlite::Connection;

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    migrate_columns(conn)?;
    seed_defaults(conn)?;
    Ok(())
}

/// Add columns that were introduced after a table was first created.
/// Idempotent — checks PRAGMA table_info before altering.
fn migrate_columns(conn: &Connection) -> Result<()> {
    // projects.path (Project-as-folder support)
    let has_path: bool = conn
        .prepare("PRAGMA table_info(projects)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .any(|name| name == "path");
    if !has_path {
        conn.execute("ALTER TABLE projects ADD COLUMN path TEXT NOT NULL DEFAULT ''", [])?;
    }

    // agent_memories provenance (Phase 5): source / confidence / origin_session_id
    let memory_cols: Vec<String> = conn
        .prepare("PRAGMA table_info(agent_memories)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !memory_cols.iter().any(|c| c == "source") {
        conn.execute(
            "ALTER TABLE agent_memories ADD COLUMN source TEXT NOT NULL DEFAULT 'user-confirmed'",
            [],
        )?;
    }
    if !memory_cols.iter().any(|c| c == "confidence") {
        conn.execute("ALTER TABLE agent_memories ADD COLUMN confidence REAL", [])?;
    }
    if !memory_cols.iter().any(|c| c == "origin_session_id") {
        conn.execute("ALTER TABLE agent_memories ADD COLUMN origin_session_id TEXT NOT NULL DEFAULT ''", [])?;
    }
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
    path         TEXT NOT NULL DEFAULT '',
    archived     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- ── Project Identity (Phase 1) ────────────────────────────────────────────
-- Lightweight profile every subsystem reads before acting: mission, tech
-- stack, architecture, coding style, current milestone, priorities, known
-- problems. Injected into agent/chat/planner context on every run.
CREATE TABLE IF NOT EXISTS project_meta (
    project_id        TEXT PRIMARY KEY,
    mission           TEXT NOT NULL DEFAULT '',
    tech_stack        TEXT NOT NULL DEFAULT '',
    architecture      TEXT NOT NULL DEFAULT '',
    coding_style      TEXT NOT NULL DEFAULT '',
    current_milestone TEXT NOT NULL DEFAULT '',
    priority          TEXT NOT NULL DEFAULT '',
    known_problems    TEXT NOT NULL DEFAULT '',
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

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

-- ── Event Store (Event Sourcing) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_store (
    id           TEXT PRIMARY KEY,
    run_id       TEXT NOT NULL DEFAULT '',
    event_type   TEXT NOT NULL,
    event_json   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_store_run ON event_store(run_id);
CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store(event_type);

-- ── Timeline Events (Phase 3) ─────────────────────────────────────────────
-- Human-readable activity feed for Mission Control, written by background
-- services (indexer, git watcher, builds watcher, agent).
CREATE TABLE IF NOT EXISTS timeline_events (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    kind         TEXT NOT NULL,
    payload      TEXT NOT NULL DEFAULT '{}',
    title        TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_workspace ON timeline_events(workspace_id, created_at DESC);

-- ── Agent Memory (Phase 4) ─────────────────────────────────────────────────
-- Persistent per-project memory: architecture, patterns, coding style,
-- tech stack, mistakes, decisions, completed tasks. Fed back into agent
-- context so nothing needs re-prompting.
CREATE TABLE IF NOT EXISTS agent_memories (
    id           TEXT PRIMARY KEY,
    project_id   TEXT NOT NULL DEFAULT '',
    workspace_id TEXT NOT NULL DEFAULT 'default',
    type         TEXT NOT NULL,
    key          TEXT NOT NULL DEFAULT '',
    value        TEXT NOT NULL,
    context      TEXT NOT NULL DEFAULT '',
    source       TEXT NOT NULL DEFAULT 'user-confirmed',
    confidence   REAL,
    origin_session_id TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_agent_memories_workspace ON agent_memories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_project ON agent_memories(project_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_memories_type_key ON agent_memories(workspace_id, project_id, type, key);

-- ── File Index ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS file_index (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    path         TEXT NOT NULL,
    hash         TEXT NOT NULL DEFAULT '',
    symbols      TEXT NOT NULL DEFAULT '[]',
    imports      TEXT NOT NULL DEFAULT '[]',
    functions    TEXT NOT NULL DEFAULT '[]',
    summary      TEXT NOT NULL DEFAULT '',
    last_modified TEXT NOT NULL DEFAULT '',
    size         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, path)
);
CREATE INDEX IF NOT EXISTS idx_file_index_workspace ON file_index(workspace_id);
CREATE INDEX IF NOT EXISTS idx_file_index_path ON file_index(path);

-- ── Workspace Graph (Phase 2) ────────────────────────────────────────────
-- Persistent dependency graph: files, directories, symbols, and the edges
-- between them (imports, defines, contains).
CREATE TABLE IF NOT EXISTS graph_nodes (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    node_type    TEXT NOT NULL,             -- file | directory | symbol
    name         TEXT NOT NULL,
    path         TEXT NOT NULL DEFAULT '',
    language     TEXT NOT NULL DEFAULT '',
    symbol_kind  TEXT NOT NULL DEFAULT '',  -- fn | struct | class | interface | ...
    size         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workspace_id, node_type, name, path)
);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_workspace ON graph_nodes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(node_type);

CREATE TABLE IF NOT EXISTS graph_edges (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL DEFAULT 'default',
    source_id    TEXT NOT NULL,
    target_id    TEXT NOT NULL,
    edge_type    TEXT NOT NULL,             -- contains | defines | imports | references
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, source_id, target_id, edge_type)
);
CREATE INDEX IF NOT EXISTS idx_graph_edges_workspace ON graph_edges(workspace_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_id);

-- ── App Config ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;
