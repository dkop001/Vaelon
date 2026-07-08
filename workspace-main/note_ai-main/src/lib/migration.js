// ── localStorage → SQLite Migration ─────────────────────────────────────────
// One-time migration from localStorage to SQLite on first Tauri launch.
// Runs automatically on app start if SQLite is empty but localStorage has data.

import {
  getNotes,
  createNote,
  setAICache,
  getProjects,
} from './db.js';

const MIGRATION_KEY = 'flow-sqlite-migrated';

export async function migrateFromLocalStorage() {
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) {
    return false;
  }

  // Check if SQLite already has notes
  const existingNotes = await getNotes();
  if (existingNotes.length > 0) {
    localStorage.setItem(MIGRATION_KEY, 'true');
    return false;
  }

  // Read from localStorage
  const rawNotes = localStorage.getItem('noteai-notes');
  const rawCache = localStorage.getItem('noteai-aicache');

  if (!rawNotes) {
    localStorage.setItem(MIGRATION_KEY, 'true');
    return false;
  }

  try {
    const notes = JSON.parse(rawNotes);
    const aiCache = rawCache ? JSON.parse(rawCache) : {};

    console.log(`[Migration] Migrating ${notes.length} notes from localStorage to SQLite`);

    // Migrate notes
    for (const note of notes) {
      await createNote({
        id: note.id,
        project_id: 'default',
        title: note.title || 'Untitled Note',
        content: note.content || '',
        tags: JSON.stringify(note.tags || []),
        pinned: note.pinned ? 1 : 0,
        created_at: note.createdAt || note.created_at,
      });
    }

    // Migrate AI cache
    for (const [noteId, cache] of Object.entries(aiCache)) {
      for (const [type, content] of Object.entries(cache)) {
        if (content) {
          await setAICache(noteId, type, typeof content === 'string' ? content : JSON.stringify(content));
        }
      }
    }

    console.log('[Migration] Migration complete');
    localStorage.setItem(MIGRATION_KEY, 'true');

    // Don't clear localStorage — keep as backup
    return true;
  } catch (err) {
    console.error('[Migration] Failed:', err);
    return false;
  }
}
