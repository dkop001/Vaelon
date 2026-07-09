// ── Note Store v2 — SQLite-backed + tags, pin, search ──────────────────────
// Drop-in replacement for noteStore.js that uses SQLite via tauri-plugin-sql.
// Falls back to localStorage if SQLite is unavailable (web dev mode).

import { create } from 'zustand';
import * as db from '../lib/db.js';

const isTauri = typeof window !== 'undefined' && window.__TAURI__;

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
        summary: note.summary || '',
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

async function loadAICache() {
  if (!isTauri) {
    try {
      return JSON.parse(localStorage.getItem('noteai-aicache') || '{}');
    } catch { return {}; }
  }
  return {};
}

export const useNoteStore = create((set, get) => ({
  notes: [],
  activeNoteId: null,
  loading: false,
  error: null,
  noteAICache: {},
  filterText: '',
  filterTag: null,

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

  setNotes: (notes) => { set({ notes }); },

  // ── Filtering ────────────────────────────────────────────────────────

  setSearchText: (text) => set({ searchText: text }),
  setFilterTag: (tag) => set({ filterTag: tag }),
  clearFilters: () => set({ searchText: '', filterTag: null }),

  getFilteredNotes: () => {
    const { notes, searchText, filterTag } = get();
    let filtered = notes;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }

    if (filterTag) {
      filtered = filtered.filter(n => {
        try {
          const tags = typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []);
          return Array.isArray(tags) && tags.includes(filterTag);
        } catch { return false; }
      });
    }

    // Pinned first, then by updated_at
    return [...filtered].sort((a, b) => {
      const aPinned = a.pinned || 0;
      const bPinned = b.pinned || 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
  },

  getAllTags: () => {
    const { notes } = get();
    const tagSet = new Set();
    for (const n of notes) {
      try {
        const tags = typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []);
        if (Array.isArray(tags)) tags.forEach(t => tagSet.add(t));
      } catch {}
    }
    return [...tagSet].sort();
  },

  // ── CRUD ─────────────────────────────────────────────────────────────

  addNote: (note) => set((s) => {
    const newNote = {
      ...note,
      id: note.id || crypto.randomUUID(),
      tags: note.tags || '[]',
      pinned: note.pinned || 0,
      created_at: note.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveNoteToDB(newNote);
    return { notes: [newNote, ...s.notes], activeNoteId: newNote.id };
  }),

  updateNote: (id, patch) => set((s) => {
    const existing = s.notes.find(n => n.id === id);
    if (!existing) return s;
    const updated = { ...existing, ...patch, updated_at: new Date().toISOString() };
    saveNoteToDB(updated);
    return { notes: s.notes.map(n => n.id === id ? updated : n) };
  }),

  deleteNote: (id) => set((s) => {
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

  // ── Pin / Unpin ──────────────────────────────────────────────────────

  togglePin: (id) => {
    const note = get().notes.find(n => n.id === id);
    if (note) get().updateNote(id, { pinned: note.pinned ? 0 : 1 });
  },

  // ── Tags ─────────────────────────────────────────────────────────────

  addTag: (id, tag) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;
    const currentTags = getTagsArray(note);
    if (currentTags.includes(tag)) return;
    get().updateNote(id, { tags: JSON.stringify([...currentTags, tag]) });
  },

  removeTag: (id, tag) => {
    const note = get().notes.find(n => n.id === id);
    if (!note) return;
    const current = getTagsArray(note).filter(t => t !== tag);
    get().updateNote(id, { tags: JSON.stringify(current) });
  },

  // ── AI Cache ─────────────────────────────────────────────────────────

  setAICache: (noteId, key, value) => set((s) => {
    const nextCache = {
      ...s.noteAICache,
      [noteId]: { ...(s.noteAICache[noteId] ?? {}), [key]: value },
    };
    if (isTauri) {
      db.setAICache(noteId, key, typeof value === 'string' ? value : JSON.stringify(value)).catch(err => {
        console.error('[noteStore] Failed to save AI cache to SQLite:', err);
      });
    }
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

function getTagsArray(note) {
  if (!note.tags) return [];
  if (Array.isArray(note.tags)) return note.tags;
  try { return JSON.parse(note.tags); } catch { return []; }
}