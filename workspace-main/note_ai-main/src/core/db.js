// ── Database Layer v2 ──────────────────────────────────────────────────────
// SQLite via tauri-plugin-sql. Single source of truth.
// Falls back to localStorage in web dev mode.

const DB_PATH = 'sqlite:flow.db';
let db = null;
let Database = null;
let useFallback = false;
let initAttempted = false;

async function ensurePluginLoaded() {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const mod = await import('@tauri-apps/plugin-sql');
    Database = mod.default;
  } catch {
    useFallback = true;
    console.log('[db] @tauri-apps/plugin-sql not available, using localStorage fallback');
  }
}

// ── Connection ──────────────────────────────────────────────────────────────

export async function getDB() {
  await ensurePluginLoaded();
  if (useFallback) return null;
  if (db) return db;
  try {
    db = await Database.load(DB_PATH);
    await runMigrations(db);
    return db;
  } catch (err) {
    console.warn('[db] Failed to load SQLite, falling back:', err.message);
    useFallback = true;
    return null;
  }
}

export async function closeDB() {
  if (db) {
    await db.close();
    db = null;
  }
}

export function isUsingFallback() {
  return useFallback;
}

// ── Migrations ──────────────────────────────────────────────────────────────

async function runMigrations(db) {
  // Workspaces
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Projects
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);`);

  // Notes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      project_id TEXT NOT NULL DEFAULT 'default',
      title TEXT NOT NULL DEFAULT 'Untitled Note',
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      summary TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes(workspace_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);`);

  // Note relations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_relations (
      id TEXT PRIMARY KEY,
      source_note_id TEXT NOT NULL,
      target_note_id TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_note_id) REFERENCES notes(id) ON DELETE CASCADE,
      UNIQUE(source_note_id, target_note_id, relation_type)
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_note_relations_source ON note_relations(source_note_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_note_relations_target ON note_relations(target_note_id);`);

  // Note attachments
  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_attachments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      path TEXT DEFAULT '',
      content BLOB,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_attachments_note ON note_attachments(note_id);`);

  // Files (project-level files)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      project_id TEXT NOT NULL DEFAULT 'default',
      path TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      content BLOB,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);`);

  // Tasks
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      project_id TEXT DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      note_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);

  // AI cache
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_cache (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      model_used TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_cache_note ON ai_cache(note_id, type);`);

  // Chat sessions
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      project_id TEXT NOT NULL DEFAULT 'default',
      title TEXT DEFAULT 'New Chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace ON chat_sessions(workspace_id);`);

  // Chat messages
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);`);

  // Build logs
  await db.execute(`
    CREATE TABLE IF NOT EXISTS build_logs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      project_id TEXT NOT NULL DEFAULT 'default',
      goal TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      outcome TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
  `);

  // Embeddings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      vector_blob BLOB,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_embeddings_note ON embeddings(note_id);`);

  // App config
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure default workspace and project exist
  const ws = await db.select('SELECT id FROM workspaces WHERE id = $1', ['default']);
  if (ws.length === 0) {
    await db.execute(
      'INSERT INTO workspaces (id, name) VALUES ($1, $2)',
      ['default', 'My Workspace']
    );
  }

  const proj = await db.select('SELECT id FROM projects WHERE id = $1', ['default']);
  if (proj.length === 0) {
    await db.execute(
      'INSERT INTO projects (id, workspace_id, name, color) VALUES ($1, $2, $3, $4)',
      ['default', 'default', 'My Notes', '#6366f1']
    );
  }
}

// ── Generic Query Helpers ─────────────────────────────────────────────────

export async function select(sql, params = []) {
  const db = await getDB();
  if (!db) return [];
  return db.select(sql, params);
}

export async function execute(sql, params = []) {
  const db = await getDB();
  if (!db) return null;
  return db.execute(sql, params);
}
