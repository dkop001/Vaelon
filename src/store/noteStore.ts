import { create } from 'zustand';
import { api, Note, SearchResult } from '../ipc/client';

export type DocumentType = 
  | 'knowledge' 
  | 'research' 
  | 'code' 
  | 'task' 
  | 'memory'
  | 'architecture' 
  | 'api-docs' 
  | 'meeting-notes' 
  | 'decision-log' 
  | 'rfc' 
  | 'prd' 
  | 'design-doc';

export interface Document extends Note {
  type: DocumentType;
}

interface DocumentState {
  documents: Document[];
  activeDocumentId: string | null;
  searchText: string;
  filterTag: string | null;
  filterType: DocumentType | null;
  searchResults: SearchResult[];
  loading: boolean;
  error: string | null;

  loadDocuments: (workspaceId: string, projectId?: string) => Promise<void>;
  selectDocument: (id: string | null) => void;
  createDocument: (workspaceId: string, projectId: string, title: string, type?: DocumentType) => Promise<void>;
  updateDocument: (document: Document) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  addTag: (id: string, tag: string) => Promise<void>;
  removeTag: (id: string, tag: string) => Promise<void>;
  searchDocuments: (workspaceId: string, query: string) => Promise<void>;
  setSearchText: (text: string) => void;
  setFilterTag: (tag: string | null) => void;
  setFilterType: (type: DocumentType | null) => void;
  clearFilters: () => void;
  getFilteredDocuments: () => Document[];
  getAllTags: () => string[];
  getDocumentsByType: (type: DocumentType) => Document[];

  // Legacy Compatibility Aliases
  notes: Document[];
  activeNoteId: string | null;
  setActiveNote: (id: string | null) => void;
  getActiveNote: () => Document | null;
  addNote: (note: Partial<Document>) => Promise<void>;
  getAICache: (noteId: string, key: string) => any;
  setAICache: (noteId: string, key: string, value: any) => Promise<void>;
  noteAICache: Record<string, Record<string, any>>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  searchText: '',
  filterTag: null,
  filterType: null,
  searchResults: [],
  loading: false,
  error: null,

  loadDocuments: async (workspaceId: string, projectId?: string) => {
    set({ loading: true, error: null });
    try {
      const list = await api.noteList(workspaceId, projectId);
      const withType = list.map(n => ({ ...n, type: 'knowledge' as DocumentType }));
      set({ documents: withType, loading: false });
      if (withType.length > 0 && !get().activeDocumentId) {
        set({ activeDocumentId: withType[0].id });
      }
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  selectDocument: (id: string | null) => {
    set({ activeDocumentId: id });
  },

  createDocument: async (workspaceId: string, projectId: string, title: string, type: DocumentType = 'knowledge') => {
    set({ loading: true, error: null });
    try {
      const n = await api.noteCreate(workspaceId, projectId, title);
      const withType = { ...n, type };
      const list = await api.noteList(workspaceId, projectId);
      const withTypes = list.map(n => ({ ...n, type: 'knowledge' as DocumentType }));
      set({ documents: withTypes, activeDocumentId: withType.id, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  updateDocument: async (document: Document) => {
    try {
      await api.noteUpdate(document);
      set((s) => ({
        documents: s.documents.map((d) => (d.id === document.id ? document : d)),
      }));
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  deleteDocument: async (id: string) => {
    const activeWs = get().documents[0]?.workspace_id || 'default';
    const activeProj = get().documents[0]?.project_id || 'default';
    set({ loading: true, error: null });
    try {
      await api.noteDelete(id);
      const list = await api.noteList(activeWs, activeProj);
      const withTypes = list.map(n => ({ ...n, type: 'knowledge' as DocumentType }));
      set({ documents: withTypes });
      if (get().activeDocumentId === id) {
        set({ activeDocumentId: withTypes[0]?.id || null });
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  togglePin: async (id: string) => {
    const document = get().documents.find((d) => d.id === id);
    if (!document) return;
    const updated = { ...document, pinned: !document.pinned };
    await get().updateDocument(updated);
  },

  addTag: async (id: string, tag: string) => {
    const document = get().documents.find((d) => d.id === id);
    if (!document) return;
    const tags = [...(document.tags || [])];
    if (tags.includes(tag)) return;
    tags.push(tag);
    await get().updateDocument({ ...document, tags });
  },

  removeTag: async (id: string, tag: string) => {
    const document = get().documents.find((d) => d.id === id);
    if (!document) return;
    const tags = (document.tags || []).filter((t) => t !== tag);
    await get().updateDocument({ ...document, tags });
  },

  searchDocuments: async (workspaceId: string, query: string) => {
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

  setFilterType: (type: DocumentType | null) => set({ filterType: type }),

  clearFilters: () => set({ searchText: '', filterTag: null, filterType: null, searchResults: [] }),

  getFilteredDocuments: () => {
    const { documents, searchText, filterTag, filterType } = get();
    let filtered = documents;

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          (d.title || '').toLowerCase().includes(q) ||
          (d.content || '').toLowerCase().includes(q)
      );
    }

    if (filterTag) {
      filtered = filtered.filter((d) => d.tags && d.tags.includes(filterTag));
    }

    if (filterType) {
      filtered = filtered.filter((d) => d.type === filterType);
    }

    return filtered;
  },

  getAllTags: () => {
    const { documents } = get();
    const tagSet = new Set<string>();
    for (const d of documents) {
      if (d.tags) {
        d.tags.forEach((t) => tagSet.add(t));
      }
    }
    return [...tagSet].sort();
  },

  getDocumentsByType: (type: DocumentType) => {
    return get().documents.filter(d => d.type === type);
  },

  // Legacy Compatibility
  get notes() { return get().documents; },
  get activeNoteId() { return get().activeDocumentId; },
  setActiveNote: (id: string | null) => set({ activeDocumentId: id }),
  getActiveNote: () => {
    const { documents, activeDocumentId } = get();
    return documents.find((d) => d.id === activeDocumentId) || null;
  },
  addNote: async (note) => {
    const ws = note.workspace_id || 'default';
    const proj = note.project_id || 'default';
    const title = note.title || 'Untitled Document';
    await get().createDocument(ws, proj, title, note.type);
  },

  noteAICache: {},

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

// Export legacy alias
export const useNoteStore = useDocumentStore;
