// ── Note Service ──────────────────────────────────────────────────────────
// Application layer for note management.
// CRUD + search + relations + AI cache.

import * as db from '../core/db.js';
import { emit, Events } from '../core/events.js';
import { register } from '../core/commands.js';
import { getActiveId as getActiveWorkspaceId } from './workspace.js';

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function list(projectId, workspaceId) {
  const wsId = workspaceId || getActiveWorkspaceId();
  if (projectId) {
    return db.select(
      'SELECT * FROM notes WHERE project_id = $1 AND workspace_id = $2 ORDER BY updated_at DESC',
      [projectId, wsId]
    );
  }
  return db.select(
    'SELECT * FROM notes WHERE workspace_id = $1 ORDER BY updated_at DESC',
    [wsId]
  );
}

export async function get(id) {
  const rows = await db.select('SELECT * FROM notes WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const wsId = data.workspace_id || getActiveWorkspaceId();
  const projectId = data.project_id || 'default';

  await db.execute(
    `INSERT INTO notes (id, workspace_id, project_id, title, content, tags, summary, pinned, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id, wsId, projectId,
      data.title || 'Untitled Note',
      data.content || '',
      data.tags || '[]',
      data.summary || '',
      data.pinned || 0,
      data.created_at || now,
      now,
    ]
  );

  const note = { id, workspace_id: wsId, project_id: projectId, ...data, created_at: data.created_at || now, updated_at: now };
  emit(Events.NOTE_CREATED, note);
  return note;
}

export async function update(id, patch) {
  const now = new Date().toISOString();
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(patch)) {
    if (['id', 'created_at', 'workspace_id'].includes(key)) continue;
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

  const note = { id, ...patch, updated_at: now };
  emit(Events.NOTE_UPDATED, note);
  return note;
}

export async function remove(id) {
  await db.execute('DELETE FROM notes WHERE id = $1', [id]);
  emit(Events.NOTE_DELETED, { id });
}

// ── Search ────────────────────────────────────────────────────────────────

export async function search(query, workspaceId) {
  const wsId = workspaceId || getActiveWorkspaceId();
  const pattern = `%${query}%`;
  return db.select(
    `SELECT * FROM notes
     WHERE workspace_id = $1 AND (title LIKE $2 OR content LIKE $2)
     ORDER BY updated_at DESC
     LIMIT 50`,
    [wsId, pattern]
  );
}

// ── Relations ─────────────────────────────────────────────────────────────

export async function getRelated(noteId) {
  const rows = await db.select(
    `SELECT n.*, nr.relation_type
     FROM note_relations nr
     JOIN notes n ON n.id = nr.target_note_id
     WHERE nr.source_note_id = $1
     ORDER BY nr.created_at DESC`,
    [noteId]
  );
  return rows;
}

export async function addRelation(sourceId, targetId, type = 'related') {
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT OR IGNORE INTO note_relations (id, source_note_id, target_note_id, relation_type)
     VALUES ($1, $2, $3, $4)`,
    [id, sourceId, targetId, type]
  );
}

export async function removeRelation(sourceId, targetId, type = 'related') {
  await db.execute(
    'DELETE FROM note_relations WHERE source_note_id = $1 AND target_note_id = $2 AND relation_type = $3',
    [sourceId, targetId, type]
  );
}

// ── AI Cache ──────────────────────────────────────────────────────────────

export async function getAICache(noteId, type) {
  const rows = await db.select(
    'SELECT content FROM ai_cache WHERE note_id = $1 AND type = $2',
    [noteId, type]
  );
  return rows[0]?.content || null;
}

export async function setAICache(noteId, type, content, modelUsed = 'unknown') {
  const id = `${noteId}-${type}`;
  await db.execute(
    `INSERT OR REPLACE INTO ai_cache (id, note_id, type, content, model_used, created_at)
     VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
    [id, noteId, type, content, modelUsed]
  );
}

// ── Commands ──────────────────────────────────────────────────────────────

register('note.create', {
  execute: (params) => create(params),
  description: 'Create a new note',
});

register('note.update', {
  execute: ({ id, ...patch }) => update(id, patch),
  description: 'Update a note',
});

register('note.delete', {
  execute: ({ id }) => remove(id),
  description: 'Delete a note',
});

register('note.search', {
  execute: ({ query }) => search(query),
  description: 'Search notes',
});
