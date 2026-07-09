// ── Project Service ───────────────────────────────────────────────────────
// Application layer for project management.

import * as db from '../core/db.js';
import { emit, Events } from '../core/events.js';
import { register } from '../core/commands.js';
import { getActiveId as getActiveWorkspaceId } from './workspace.js';

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function list(workspaceId) {
  const wsId = workspaceId || getActiveWorkspaceId();
  return db.select(
    'SELECT * FROM projects WHERE workspace_id = $1 AND archived = 0 ORDER BY created_at DESC',
    [wsId]
  );
}

export async function get(id) {
  const rows = await db.select('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const wsId = data.workspace_id || getActiveWorkspaceId();

  await db.execute(
    'INSERT INTO projects (id, workspace_id, name, description, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [id, wsId, data.name, data.description || '', data.color || '#6366f1', now, now]
  );

  const project = { id, workspace_id: wsId, ...data, created_at: now, updated_at: now };
  emit(Events.PROJECT_CREATED, project);
  return project;
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
    `UPDATE projects SET ${fields.join(', ')} WHERE id = $${idx + 1}`,
    values
  );

  const project = { id, ...patch, updated_at: now };
  emit(Events.PROJECT_UPDATED, project);
  return project;
}

export async function remove(id) {
  await db.execute('DELETE FROM projects WHERE id = $1', [id]);
  emit(Events.PROJECT_DELETED, { id });
}

export async function archive(id) {
  return update(id, { archived: 1 });
}

// ── Commands ──────────────────────────────────────────────────────────────

register('project.create', {
  execute: (params) => create(params),
  description: 'Create a new project',
});

register('project.update', {
  execute: ({ id, ...patch }) => update(id, patch),
  description: 'Update a project',
});

register('project.delete', {
  execute: ({ id }) => remove(id),
  description: 'Delete a project',
});
