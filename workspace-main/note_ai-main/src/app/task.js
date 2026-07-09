// ── Task Service ──────────────────────────────────────────────────────────
// Application layer for task management.

import * as db from '../core/db.js';
import { emit, Events } from '../core/events.js';
import { register } from '../core/commands.js';
import { getActiveId as getActiveWorkspaceId } from './workspace.js';

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function list(filters = {}) {
  const wsId = filters.workspace_id || getActiveWorkspaceId();
  let sql = 'SELECT * FROM tasks WHERE workspace_id = $1';
  const params = [wsId];

  if (filters.status) {
    sql += ` AND status = $${params.length + 1}`;
    params.push(filters.status);
  }

  if (filters.project_id) {
    sql += ` AND project_id = $${params.length + 1}`;
    params.push(filters.project_id);
  }

  sql += ' ORDER BY created_at DESC';
  return db.select(sql, params);
}

export async function get(id) {
  const rows = await db.select('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const wsId = data.workspace_id || getActiveWorkspaceId();

  await db.execute(
    `INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, due_date, note_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id, wsId, data.project_id || '',
      data.title, data.description || '',
      data.status || 'pending', data.priority || 'medium',
      data.due_date || null, data.note_id || null,
      now, now,
    ]
  );

  const task = { id, workspace_id: wsId, ...data, created_at: now, updated_at: now };
  emit(Events.TASK_CREATED, task);
  return task;
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
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx + 1}`,
    values
  );

  const task = { id, ...patch, updated_at: now };
  emit(Events.TASK_UPDATED, task);
  return task;
}

export async function remove(id) {
  await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
  emit(Events.TASK_DELETED, { id });
}

// ── Commands ──────────────────────────────────────────────────────────────

register('task.create', {
  execute: (params) => create(params),
  description: 'Create a new task',
});

register('task.update', {
  execute: ({ id, ...patch }) => update(id, patch),
  description: 'Update a task',
});

register('task.delete', {
  execute: ({ id }) => remove(id),
  description: 'Delete a task',
});

register('task.complete', {
  execute: ({ id }) => update(id, { status: 'completed' }),
  description: 'Mark a task as completed',
});
