// ── Workspace Service ─────────────────────────────────────────────────────
// Application layer for workspace management.
// Nothing outside this file touches the workspaces table directly.

import * as db from '../core/db.js';
import { emit, Events } from '../core/events.js';
import { register } from '../core/commands.js';

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function list() {
  return db.select('SELECT * FROM workspaces ORDER BY created_at DESC');
}

export async function get(id) {
  const rows = await db.select('SELECT * FROM workspaces WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function create(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO workspaces (id, name, path, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, data.name, data.path || '', data.description || '', now, now]
  );

  const workspace = { id, ...data, created_at: now, updated_at: now };
  emit(Events.WORKSPACE_CREATED, workspace);
  return workspace;
}

export async function update(id, patch) {
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
    `UPDATE workspaces SET ${fields.join(', ')} WHERE id = $${idx + 1}`,
    values
  );

  const workspace = { id, ...patch, updated_at: now };
  emit(Events.WORKSPACE_UPDATED, workspace);
  return workspace;
}

export async function remove(id) {
  await db.execute('DELETE FROM workspaces WHERE id = $1', [id]);
  emit(Events.WORKSPACE_DELETED, { id });
}

// ── Active Workspace ──────────────────────────────────────────────────────

let activeWorkspaceId = 'default';

export function getActiveId() {
  return activeWorkspaceId;
}

export async function getActive() {
  return get(activeWorkspaceId);
}

export async function setActive(id) {
  activeWorkspaceId = id;
  emit(Events.WORKSPACE_CHANGED, { id });
}

// ── Init ──────────────────────────────────────────────────────────────────

export async function init() {
  const workspaces = await list();
  if (workspaces.length === 0) {
    await create({ id: 'default', name: 'My Workspace' });
  } else {
    activeWorkspaceId = workspaces[0].id;
  }
}

// ── Commands ──────────────────────────────────────────────────────────────

register('workspace.create', {
  execute: (params) => create(params),
  description: 'Create a new workspace',
});

register('workspace.update', {
  execute: ({ id, ...patch }) => update(id, patch),
  description: 'Update a workspace',
});

register('workspace.delete', {
  execute: ({ id }) => remove(id),
  description: 'Delete a workspace',
});

register('workspace.switch', {
  execute: ({ id }) => setActive(id),
  description: 'Switch active workspace',
});
