// ── Agent Memory Store ───────────────────────────────────────────────────────
// Per-project memory: architecture, patterns, coding style, tech stack, mistakes,
// past conversations, folder structure, completed tasks. No repeated prompting.

import { create } from 'zustand';

export interface MemoryEntry {
  id: string;
  project_id: string;
  workspace_id: string;
  type: MemoryType;
  key: string;
  value: string;
  context?: string;
  created_at: string;
  updated_at: string;
}

export type MemoryType = 
  | 'architecture' 
  | 'patterns' 
  | 'coding-style' 
  | 'tech-stack' 
  | 'mistakes' 
  | 'conversations' 
  | 'folder-structure' 
  | 'completed-tasks'
  | 'decisions'
  | 'custom';

interface AgentMemoryState {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;

  init: (projectId: string, workspaceId: string) => Promise<void>;
  loadMemories: (projectId: string, workspaceId: string) => Promise<void>;
  getMemory: (type: MemoryType, key?: string) => MemoryEntry | MemoryEntry[] | null;
  setMemory: (entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMemory: (id: string, value: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  getContextForAgent: () => string;
  clearProjectMemories: () => void;
}

const TYPE_LABELS: Record<MemoryType, string> = {
  'architecture': 'Architecture',
  'patterns': 'Patterns & Conventions',
  'coding-style': 'Coding Style',
  'tech-stack': 'Tech Stack',
  'mistakes': 'Common Mistakes',
  'conversations': 'Past Conversations',
  'folder-structure': 'Folder Structure',
  'completed-tasks': 'Completed Tasks',
  'decisions': 'Decisions & Rationale',
  'custom': 'Custom',
};

function newId() { return crypto.randomUUID(); }
function nowStr() { return new Date().toISOString(); }

export const useAgentMemoryStore = create<AgentMemoryState>((set, get) => ({
  memories: [],
  loading: false,
  error: null,

  init: async (projectId: string, workspaceId: string) => {
    await get().loadMemories(projectId, workspaceId);
  },

  loadMemories: async () => {
    set({ loading: true, error: null });
    try {
      // Backend doesn't have memory commands yet, store locally for now
      const list: MemoryEntry[] = [];
      set({ memories: list, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  getMemory: (type: MemoryType, key?: string) => {
    const { memories } = get();
    const filtered = memories.filter(m => m.type === type);
    if (key) {
      return filtered.find(m => m.key === key) || null;
    }
    return filtered.length > 0 ? filtered : null;
  },

  setMemory: async (entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'>) => {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: newId(),
      created_at: nowStr(),
      updated_at: nowStr(),
    };
    set(s => ({ memories: [...s.memories, fullEntry] }));
  },

  updateMemory: async (id: string, value: string) => {
    set(s => ({
      memories: s.memories.map(m => m.id === id ? { ...m, value, updated_at: nowStr() } : m)
    }));
  },

  deleteMemory: async (id: string) => {
    set(s => ({ memories: s.memories.filter(m => m.id !== id) }));
  },

  getContextForAgent: () => {
    const { memories } = get();
    if (memories.length === 0) return '';
    
    const byType = memories.reduce((acc, m) => {
      if (!acc[m.type]) acc[m.type] = [];
      acc[m.type].push(m);
      return acc;
    }, {} as Record<MemoryType, MemoryEntry[]>);

    const sections = Object.entries(byType).map(([type, entries]) => {
      const label = TYPE_LABELS[type as MemoryType] || type;
      const content = entries.map(e => e.key ? `${e.key}: ${e.value}` : e.value).join('\n');
      return `## ${label}\n${content}`;
    }).join('\n\n');

    return `--- PROJECT MEMORY ---\n${sections}\n--- END MEMORY ---`;
  },

  clearProjectMemories: () => {
    set({ memories: [] });
  },
}));