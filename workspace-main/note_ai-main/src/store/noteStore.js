// ── Note Store — SQLite-backed ──────────────────────────────────────────────
// Drop-in replacement for noteStore.js that uses SQLite via tauri-plugin-sql.
// Falls back to localStorage if SQLite is unavailable (web dev mode).

import { create } from 'zustand';
import * as db from '../lib/db.js';

// Check if we're running in Tauri (has window.__TAURI__)
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

// ── SQLite operations ───────────────────────────────────────────────────────

async function loadNotes() {
  if (!isTauri) {
    try {
      return JSON.parse(localStorage.getItem('noteai-notes') || '[]');
    } catch { return []; }
  }
  try {
    return await db.getNotes();
  } catch (err) {
    console.error('[noteStore] Failed to load from SQLite:', err);
    return [];
  }
}

async function saveNoteToDB(note) {
  if (!isTauri) {
    // Fallback: save to localStorage
    const notes = JSON.parse(localStorage.getItem('noteai-notes') || '[]');
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx !== -1) notes[idx] = note;
    else notes.unshift(note);
    localStorage.setItem('noteai-notes', JSON.stringify(notes));
    return;
  }
  try {
    const existing = await db.getNote(note.id);
    if (existing) {
      await db.updateNote(note.id, {
        title: note.title,
        content: note.content,
        tags: note.tags,
        pinned: note.pinned,
      });
    } else {
      await db.createNote(note);
    }
  } catch (err) {
    console.error('[noteStore] Failed to save to SQLite:', err);
  }
}

async function deleteNoteFromDB(id) {
  if (!isTauri) {
    const notes = JSON.parse(localStorage.getItem('noteai-notes') || '[]');
    localStorage.setItem('noteai-notes', JSON.stringify(notes.filter(n => n.id !== id)));
    return;
  }
  try {
    await db.deleteNote(id);
  } catch (err) {
    console.error('[noteStore] Failed to delete from SQLite:', err);
  }
}

// ── AI Cache ────────────────────────────────────────────────────────────────

async function loadAICache() {
  if (!isTauri) {
    try {
      return JSON.parse(localStorage.getItem('noteai-aicache') || '{}');
    } catch { return {}; }
  }
  // SQLite cache is accessed per-note via db.getAICache()
  // Return empty object for Zustand; actual reads go through db.getAICache()
  return {};
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useNoteStore = create((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  error: null,
  noteAICache: {},

  // Load notes from database on init
  init: async () => {
    set({ loading: true });
    try {
      const notes = await loadNotes();
      const cache = await loadAICache();
      set({ notes, noteAICache: cache, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  setNotes: (notes) => {
    set({ notes });
  },

  addNote: (note) => set((s) => {
    const newNote = {
      ...note,
      id: note.id || crypto.randomUUID(),
      created_at: note.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save async — don't block UI
    saveNoteToDB(newNote);

    return {
      notes: [newNote, ...s.notes],
      activeNoteId: newNote.id,
    };
  }),

  updateNote: (id, patch) => set((s) => {
    const updated = {
      ...s.notes.find(n => n.id === id),
      ...patch,
      updated_at: new Date().toISOString(),
    };

    // Save async
    saveNoteToDB(updated);

    return {
      notes: s.notes.map(n => n.id === id ? updated : n),
    };
  }),

  deleteNote: (id) => set((s) => {
    // Delete async
    deleteNoteFromDB(id);

    const nextNotes = s.notes.filter(n => n.id !== id);
    return {
      notes: nextNotes,
      activeNoteId: s.activeNoteId === id ? (nextNotes[0]?.id ?? null) : s.activeNoteId,
    };
  }),

  setActiveNote: (id) => set({ activeNoteId: id }),

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find(n => n.id === activeNoteId) ?? null;
  },

  // AI Cache — reads from SQLite when in Tauri
  setAICache: (noteId, key, value) => set((s) => {
    const nextCache = {
      ...s.noteAICache,
      [noteId]: { ...(s.noteAICache[noteId] ?? {}), [key]: value },
    };

    // Also save to SQLite
    if (isTauri) {
      db.setAICache(noteId, key, typeof value === 'string' ? value : JSON.stringify(value)).catch(err => {
        console.error('[noteStore] Failed to save AI cache to SQLite:', err);
      });
    }

    // Keep localStorage as backup
    localStorage.setItem('noteai-aicache', JSON.stringify(nextCache));

    return { noteAICache: nextCache };
  }),

  getAICache: (noteId, key) => {
    const { noteAICache } = get();
    return noteAICache[noteId]?.[key] ?? null;
  },

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
}));
