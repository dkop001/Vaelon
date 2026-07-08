const CHAT_STORAGE_KEY = 'flow-chat-data';

function getAllData() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAllData(data) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
}

// ── Session management ──────────────────────────────────────────────────────

export function getOrCreateSession(userId, noteId, noteTitle) {
  const data = getAllData();
  const key = userId || 'local';
  const userSessions = data[key] || {};

  if (userSessions[noteId]) {
    console.log('[chatApi] Found existing session:', userSessions[noteId].id);
    return Promise.resolve(userSessions[noteId]);
  }

  const session = {
    id: `${key}-${noteId}-${Date.now()}`,
    userId: key,
    noteId,
    noteTitle,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!data[key]) data[key] = {};
  data[key][noteId] = session;
  saveAllData(data);
  console.log('[chatApi] Created new session:', session.id);

  return Promise.resolve(session);
}

export function getUserSessions(userId) {
  const data = getAllData();
  const userSessions = data[userId || 'local'] || {};
  return Promise.resolve(Object.values(userSessions));
}

export function deleteSession(userId, noteId) {
  const data = getAllData();
  const key = userId || 'local';
  if (data[key]) {
    delete data[key][noteId];
    saveAllData(data);
  }
  return Promise.resolve();
}

export function saveConversation(sessionId, messages) {
  const data = getAllData();
  console.log('[chatApi] saveConversation called, sessionId:', sessionId);

  for (const userId of Object.keys(data)) {
    for (const noteId of Object.keys(data[userId])) {
      const session = data[userId][noteId];
      if (session.id === sessionId) {
        session.messages = messages.map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text || m.content,
          timestamp: new Date().toISOString(),
        }));
        session.updatedAt = new Date().toISOString();
        saveAllData(data);
        console.log('[chatApi] Saved', session.messages.length, 'messages to session', sessionId);
        return Promise.resolve();
      }
    }
  }

  console.log('[chatApi] WARNING: Session not found:', sessionId);
  return Promise.resolve();
}

export function getChatHistory(userId, noteId) {
  const data = getAllData();
  const session = data[userId || 'local']?.[noteId];
  return Promise.resolve(session?.messages || []);
}

export function saveMessage(userId, noteId, message) {
  const data = getAllData();
  const key = userId || 'local';

  if (!data[key]) data[key] = {};
  if (!data[key][noteId]) {
    data[key][noteId] = {
      id: `${key}-${noteId}-${Date.now()}`,
      userId: key,
      noteId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const session = data[key][noteId];
  if (!session.messages) session.messages = [];
  session.messages.push({
    role: message.role === 'ai' ? 'assistant' : 'user',
    content: message.text || message.content,
    timestamp: new Date().toISOString(),
  });
  session.updatedAt = new Date().toISOString();
  saveAllData(data);

  return Promise.resolve();
}

export function getSessionHistory(userId, noteId) {
  const data = getAllData();
  const session = data[userId || 'local']?.[noteId];
  return Promise.resolve(session?.messages || []);
}

export function getAllSessions(userId) {
  const data = getAllData();
  const userSessions = data[userId || 'local'] || {};
  return Promise.resolve(Object.values(userSessions));
}
