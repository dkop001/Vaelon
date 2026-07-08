// ── Database Layer ───────────────────────────────────────────────────────────
// SQLite via tauri-plugin-sql. Single source of truth for all persistent data.
// Falls back to localStorage if the plugin is not available (web dev mode).

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
    console.warn('[db] Failed to load SQLite, falling back to localStorage:', err.message);
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'default',
      title TEXT NOT NULL DEFAULT 'Untitled Note',
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);`);

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'default',
      title TEXT DEFAULT 'New Chat',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);`);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS build_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL DEFAULT 'default',
      goal TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      outcome TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_build_logs_project ON build_logs(project_id);`);

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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Ensure default project exists
  const existing = await db.select('SELECT id FROM projects WHERE id = $1', ['default']);
  if (existing.length === 0) {
    await db.execute(
      'INSERT INTO projects (id, name, color) VALUES ($1, $2, $3)',
      ['default', 'My Notes', '#6366f1']
    );
  }
}

// ── Notes CRUD ──────────────────────────────────────────────────────────────

export async function getNotes(projectId = 'default') {
  const db = await getDB();
  return db.select(
    'SELECT * FROM notes WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  );
}

export async function getNote(id) {
  const db = await getDB();
  const rows = await db.select('SELECT * FROM notes WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createNote(note) {
  const db = await getDB();
  const id = note.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO notes (id, project_id, title, content, tags, pinned, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      note.project_id || 'default',
      note.title || 'Untitled Note',
      note.content || '',
      note.tags || '[]',
      note.pinned || 0,
      note.created_at || now,
      now,
    ]
  );

  return { id, ...note, created_at: note.created_at || now, updated_at: now };
}

export async function updateNote(id, patch) {
  const db = await getDB();
  const now = new Date().toISOString();
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(patch)) {
    if (['id', 'created_at'].includes(key)) continue;
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  fields.push(`updated_at = $${idx}`);
  values.push(now);
  values.push(id);

  await db.execute(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx + 1}`,
    values
  );

  return { id, ...patch, updated_at: now };
}

export async function deleteNote(id) {
  const db = await getDB();
  await db.execute('DELETE FROM notes WHERE id = $1', [id]);
}

// ── AI Cache ────────────────────────────────────────────────────────────────

export async function getAICache(noteId, type) {
  const db = await getDB();
  const rows = await db.select(
    'SELECT content FROM ai_cache WHERE note_id = $1 AND type = $2',
    [noteId, type]
  );
  return rows[0]?.content || null;
}

export async function setAICache(noteId, type, content, modelUsed = 'unknown') {
  const db = await getDB();
  const id = `${noteId}-${type}`;

  await db.execute(
    `INSERT OR REPLACE INTO ai_cache (id, note_id, type, content, model_used, created_at)
     VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
    [id, noteId, type, content, modelUsed]
  );
}

// ── Chat Sessions ───────────────────────────────────────────────────────────

export async function getChatSessions(projectId = 'default') {
  const db = await getDB();
  return db.select(
    'SELECT * FROM chat_sessions WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  );
}

export async function createChatSession(session) {
  const db = await getDB();
  const id = session.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO chat_sessions (id, project_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, session.project_id || 'default', session.title || 'New Chat', now, now]
  );

  return { id, ...session, created_at: now, updated_at: now };
}

export async function getChatMessages(sessionId) {
  const db = await getDB();
  return db.select(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
}

export async function saveChatMessage(message) {
  const db = await getDB();
  const id = message.id || crypto.randomUUID();

  await db.execute(
    'INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, message.session_id, message.role, message.content, message.created_at || new Date().toISOString()]
  );

  // Update session timestamp
  await db.execute(
    'UPDATE chat_sessions SET updated_at = datetime(\'now\') WHERE id = $1',
    [message.session_id]
  );

  return { id, ...message };
}

// ── Build Logs ──────────────────────────────────────────────────────────────

export async function saveBuildLog(log) {
  const db = await getDB();
  const id = log.id || crypto.randomUUID();

  await db.execute(
    `INSERT INTO build_logs (id, project_id, goal, steps_json, outcome, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      log.project_id || 'default',
      log.goal,
      JSON.stringify(log.steps),
      log.outcome,
      log.notes || '',
      log.created_at || new Date().toISOString(),
    ]
  );

  return { id, ...log };
}

export async function getBuildLogs(projectId = 'default') {
  const db = await getDB();
  return db.select(
    'SELECT * FROM build_logs WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId]
  );
}

// ── App Config ──────────────────────────────────────────────────────────────

export async function getConfig(key) {
  const db = await getDB();
  const rows = await db.select('SELECT value FROM app_config WHERE key = $1', [key]);
  return rows[0]?.value || null;
}

export async function setConfig(key, value) {
  const db = await getDB();
  await db.execute(
    'INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ($1, $2, datetime(\'now\'))',
    [key, String(value)]
  );
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function getProjects() {
  const db = await getDB();
  return db.select('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC');
}

export async function createProject(project) {
  const db = await getDB();
  const id = project.id || crypto.randomUUID();

  await db.execute(
    'INSERT INTO projects (id, name, description, color) VALUES ($1, $2, $3, $4)',
    [id, project.name, project.description || '', project.color || '#6366f1']
  );

  return { id, ...project };
}
