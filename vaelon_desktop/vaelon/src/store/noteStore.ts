import { create } from 'zustand';
import { api, Note, SearchResult } from '../ipc/client';

interface NoteState {
  notes: Note[];
  activeNoteId: string | null;
  searchText: string;
  filterTag: string | null;
  searchResults: SearchResult[];
  loading: boolean;
  error: string | null;

  loadNotes: (workspaceId: string, projectId?: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  createNote: (workspaceId: string, projectId: string, title: string) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addTag: (id: string, tag: string) => Promise<void>;
  removeTag: (id: string, tag: string) => Promise<void>;
  searchNotes: (workspaceId: string, query: string) => Promise<void>;
  setSearchText: (text: string) => void;
  setFilterTag: (tag: string | null) => void;
  clearFilters: () => void;
  getFilteredNotes: () => Note[];
  getAllTags: () => string[];

  // Legacy Compatibility Aliases
  setActiveNote: (id: string | null) => void;
  getActiveNote: () => Note | null;
  addNote: (note: Partial<Note>) => Promise<void>;
  getAICache: (noteId: string, key: string) => any;
  setAICache: (noteId: string, key: string, value: any) => Promise<void>;
  noteAICache: Record<string, Record<string, any>>;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  searchText: '',
  filterTag: null,
  searchResults: [],
  loading: false,
  error: null,

  loadNotes: async (workspaceId: string, projectId?: string) => {
    set({ loading: true, error: null });
    try {
      const list = await api.noteList(workspaceId, projectId);
      set({ notes: list, loading: false });
      if (list.length > 0 && !get().activeNoteId) {
        set({ activeNoteId: list[0].id });
      }
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  selectNote: (id: string | null) => {
    set({ activeNoteId: id });
  },

  createNote: async (workspaceId: string, projectId: string, title: string) => {
    set({ loading: true, error: null });
    try {
      const n = await api.noteCreate(workspaceId, projectId, title);
      const list = await api.noteList(workspaceId, projectId);
      set({ notes: list, activeNoteId: n.id, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  updateNote: async (note: Note) => {
    try {
      await api.noteUpdate(note);
      set((s) => ({
        notes: s.notes.map((n) => (n.id === note.id ? note : n)),
      }));
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  deleteNote: async (id: string) => {
    const activeWs = get().notes[0]?.workspace_id || 'default';
    const activeProj = get().notes[0]?.project_id || 'default';
    set({ loading: true, error: null });
    try {
      await api.noteDelete(id);
      const list = await api.noteList(activeWs, activeProj);
      set({ notes: list });
      if (get().activeNoteId === id) {
        set({ activeNoteId: list[0]?.id || null });
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  togglePin: async (id: string) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const updated = { ...note, pinned: !note.pinned };
    await get().updateNote(updated);
  },

  addTag: async (id: string, tag: string) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const tags = [...(note.tags || [])];
    if (tags.includes(tag)) return;
    tags.push(tag);
    await get().updateNote({ ...note, tags });
  },

  removeTag: async (id: string, tag: string) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const tags = (note.tags || []).filter((t) => t !== tag);
    await get().updateNote({ ...note, tags });
  },

  searchNotes: async (workspaceId: string, query: string) => {
    if (!query) {
      set({ searchResults: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      const results = await api.noteSearch(workspaceId, query);
      set({ searchResults: results, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  setSearchText: (text: string) => set({ searchText: text }),

  setFilterTag: (tag: string | null) => set({ filterTag: tag }),

  clearFilters: () => set({ searchText: '', filterTag: null, searchResults: [] }),

  getFilteredNotes: () => {
    const { notes, searchText, filterTag } = get();
    let filtered = notes;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q)
      );
    }

    if (filterTag) {
      filtered = filtered.filter((n) => n.tags && n.tags.includes(filterTag));
    }

    return filtered;
  },

  getAllTags: () => {
    const { notes } = get();
    const tagSet = new Set<string>();
    for (const n of notes) {
      if (n.tags) {
        n.tags.forEach((t) => tagSet.add(t));
      }
    }
    return [...tagSet].sort();
  },

  // Legacy Compatibility Implementations
  noteAICache: {},

  setActiveNote: (id) => {
    set({ activeNoteId: id });
  },

  getActiveNote: () => {
    const { notes, activeNoteId } = get();
    return notes.find((n) => n.id === activeNoteId) || null;
  },

  addNote: async (note) => {
    const ws = note.workspace_id || 'default';
    const proj = note.project_id || 'default';
    const title = note.title || 'Untitled Note';
    await get().createNote(ws, proj, title);
  },

  getAICache: (noteId, key) => {
    return get().noteAICache[noteId]?.[key] || null;
  },

  setAICache: async (noteId, key, value) => {
    set((s) => ({
      noteAICache: {
        ...s.noteAICache,
        [noteId]: {
          ...(s.noteAICache[noteId] || {}),
          [key]: value,
        },
      },
    }));
  },
}));
