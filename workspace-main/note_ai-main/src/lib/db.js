// ── Database Layer (Legacy Re-export) ─────────────────────────────────────
// All functionality moved to src/core/db.js
// This file re-exports for backward compatibility.

export { getDB, closeDB, isUsingFallback, select, execute } from '../core/db.js';

// ── Legacy CRUD helpers (maintain old API) ─────────────────────────────────

import * as coreDb from '../core/db.js';

export async function getNotes(projectId = 'default') {
  return coreDb.select(
    'SELECT * FROM notes WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  );
}

export async function getNote(id) {
  const rows = await coreDb.select('SELECT * FROM notes WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createNote(note) {
  const id = note.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await coreDb.execute(
    `INSERT INTO notes (id, workspace_id, project_id, title, content, tags, pinned, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      note.workspace_id || 'default',
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

  await coreDb.execute(
    `UPDATE notes SET ${fields.join(', ')} WHERE id = $${idx + 1}`,
    values
  );

  return { id, ...patch, updated_at: now };
}

export async function deleteNote(id) {
  await coreDb.execute('DELETE FROM notes WHERE id = $1', [id]);
}

export async function getAICache(noteId, type) {
  const rows = await coreDb.select(
    'SELECT content FROM ai_cache WHERE note_id = $1 AND type = $2',
    [noteId, type]
  );
  return rows[0]?.content || null;
}

export async function setAICache(noteId, type, content, modelUsed = 'unknown') {
  const id = `${noteId}-${type}`;
  await coreDb.execute(
    `INSERT OR REPLACE INTO ai_cache (id, note_id, type, content, model_used, created_at)
     VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
    [id, noteId, type, content, modelUsed]
  );
}

export async function getChatSessions(projectId = 'default') {
  return coreDb.select(
    'SELECT * FROM chat_sessions WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  );
}

export async function createChatSession(session) {
  const id = session.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await coreDb.execute(
    'INSERT INTO chat_sessions (id, workspace_id, project_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, session.workspace_id || 'default', session.project_id || 'default', session.title || 'New Chat', now, now]
  );

  return { id, ...session, created_at: now, updated_at: now };
}

export async function getChatMessages(sessionId) {
  return coreDb.select(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
}

export async function saveChatMessage(message) {
  const id = message.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await coreDb.execute(
    'INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, message.session_id, message.role, message.content, message.metadata || '{}', message.created_at || now]
  );

  await coreDb.execute(
    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = $1",
    [message.session_id]
  );

  return { id, ...message };
}

export async function saveBuildLog(log) {
  const id = log.id || crypto.randomUUID();

  await coreDb.execute(
    `INSERT INTO build_logs (id, workspace_id, project_id, goal, steps_json, outcome, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      log.workspace_id || 'default',
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
  return coreDb.select(
    'SELECT * FROM build_logs WHERE project_id = $1 ORDER BY created_at DESC',
    [projectId]
  );
}

export async function getConfig(key) {
  const rows = await coreDb.select('SELECT value FROM app_config WHERE key = $1', [key]);
  return rows[0]?.value || null;
}

export async function setConfig(key, value) {
  await coreDb.execute(
    "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ($1, $2, datetime('now'))",
    [key, String(value)]
  );
}

export async function getProjects() {
  return coreDb.select('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC');
}

export async function createProject(project) {
  const id = project.id || crypto.randomUUID();

  await coreDb.execute(
    'INSERT INTO projects (id, workspace_id, name, description, color) VALUES ($1, $2, $3, $4, $5)',
    [id, project.workspace_id || 'default', project.name, project.description || '', project.color || '#6366f1']
  );

  return { id, ...project };
}
