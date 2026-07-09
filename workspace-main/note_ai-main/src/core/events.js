// ── Event Bus ──────────────────────────────────────────────────────────────
// Lightweight pub/sub for app-wide events.
// Decouples services — nothing imports each other directly.

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);

  // Return unsubscribe function
  return () => {
    const set = listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    }
  };
}

export function emit(event, data) {
  const set = listeners.get(event);
  if (!set) return;

  for (const handler of set) {
    try {
      handler(data);
    } catch (err) {
      console.error(`[events] Error in handler for "${event}":`, err);
    }
  }
}

export function once(event, handler) {
  const unsub = on(event, (data) => {
    unsub();
    handler(data);
  });
  return unsub;
}

export function off(event, handler) {
  const set = listeners.get(event);
  if (set) {
    set.delete(handler);
    if (set.size === 0) listeners.delete(event);
  }
}

export function clear() {
  listeners.clear();
}

// ── Named Events ──────────────────────────────────────────────────────────

export const Events = {
  // Workspace
  WORKSPACE_CREATED: 'workspace:created',
  WORKSPACE_UPDATED: 'workspace:updated',
  WORKSPACE_DELETED: 'workspace:deleted',
  WORKSPACE_CHANGED: 'workspace:changed',

  // Project
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_DELETED: 'project:deleted',
  PROJECT_CHANGED: 'project:changed',

  // Note
  NOTE_CREATED: 'note:created',
  NOTE_UPDATED: 'note:updated',
  NOTE_DELETED: 'note:deleted',
  NOTE_CHANGED: 'note:changed',

  // Chat
  CHAT_SESSION_CREATED: 'chat:session-created',
  CHAT_MESSAGE_ADDED: 'chat:message-added',
  CHAT_SESSION_CHANGED: 'chat:session-changed',

  // Task
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',

  // AI
  AI_REQUEST_START: 'ai:request-start',
  AI_REQUEST_END: 'ai:request-end',
  AI_STREAM_CHUNK: 'ai:stream-chunk',

  // Agent
  AGENT_START: 'agent:start',
  AGENT_END: 'agent:end',
  AGENT_STEP: 'agent:step',
  AGENT_CHECKPOINT: 'agent:checkpoint',

  // System
  DB_READY: 'db:ready',
  APP_READY: 'app:ready',
};
