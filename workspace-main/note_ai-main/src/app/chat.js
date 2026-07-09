// ── Chat Service ──────────────────────────────────────────────────────────
// Application layer for chat management.

import * as db from '../core/db.js';
import { emit, Events } from '../core/events.js';
import { register } from '../core/commands.js';
import { getActiveId as getActiveWorkspaceId } from './workspace.js';

// ── Sessions ──────────────────────────────────────────────────────────────

export async function listSessions(projectId, workspaceId) {
  const wsId = workspaceId || getActiveWorkspaceId();
  if (projectId) {
    return db.select(
      'SELECT * FROM chat_sessions WHERE project_id = $1 AND workspace_id = $2 ORDER BY updated_at DESC',
      [projectId, wsId]
    );
  }
  return db.select(
    'SELECT * FROM chat_sessions WHERE workspace_id = $1 ORDER BY updated_at DESC',
    [wsId]
  );
}

export async function getSession(id) {
  const rows = await db.select('SELECT * FROM chat_sessions WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createSession(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const wsId = data.workspace_id || getActiveWorkspaceId();
  const projectId = data.project_id || 'default';

  await db.execute(
    'INSERT INTO chat_sessions (id, workspace_id, project_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, wsId, projectId, data.title || 'New Chat', now, now]
  );

  const session = { id, workspace_id: wsId, project_id: projectId, title: data.title || 'New Chat', created_at: now, updated_at: now };
  emit(Events.CHAT_SESSION_CREATED, session);
  return session;
}

export async function deleteSession(id) {
  await db.execute('DELETE FROM chat_sessions WHERE id = $1', [id]);
}

// ── Messages ──────────────────────────────────────────────────────────────

export async function getMessages(sessionId) {
  return db.select(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
}

export async function addMessage(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    'INSERT INTO chat_messages (id, session_id, role, content, metadata, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, data.session_id, data.role, data.content, data.metadata || '{}', data.created_at || now]
  );

  // Update session timestamp
  await db.execute(
    "UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = $1",
    [data.session_id]
  );

  const message = { id, ...data, created_at: data.created_at || now };
  emit(Events.CHAT_MESSAGE_ADDED, message);
  return message;
}

// ── Commands ──────────────────────────────────────────────────────────────

register('chat.createSession', {
  execute: (params) => createSession(params),
  description: 'Create a new chat session',
});

register('chat.sendMessage', {
  execute: (params) => addMessage(params),
  description: 'Send a chat message',
});

register('chat.deleteSession', {
  execute: ({ id }) => deleteSession(id),
  description: 'Delete a chat session',
});
