// ── Agent Memory Store ───────────────────────────────────────────────────────
// Per-project memory: architecture, patterns, coding style, tech stack, mistakes,
// past conversations, folder structure, completed tasks. No repeated prompting.
// Phase 5: provenance (source/confidence), opt-out auto-capture, review queue.

import { create } from 'zustand';
import { api, MemoryEntry, MemoryType, onEvent } from '../ipc/client';
import { useWorkspaceStore } from './workspaceStore';

export type { MemoryEntry, MemoryType };

interface AgentMemoryState {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;
  autoCapture: boolean;

  init: (projectId: string, workspaceId: string) => Promise<void>;
  loadMemories: (projectId: string, workspaceId: string) => Promise<void>;
  getMemory: (type: MemoryType, key?: string) => MemoryEntry | MemoryEntry[] | null;
  setMemory: (entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMemory: (id: string, value: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  confirmMemory: (id: string, value?: string) => Promise<void>;
  loadAutoCapture: () => Promise<void>;
  setAutoCapture: (enabled: boolean) => Promise<void>;
  captureFromChat: (opts: {
    userText: string;
    projectId: string;
    workspaceId: string;
    sessionId: string;
  }) => Promise<Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'> | null>;
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

// Deterministic, cheap capture triggers for Chat Mode (FR-2) — no LLM call.
const TRIGGER_PATTERNS: RegExp[] = [
  /\bremember\s+(this|that|to)\b/i,
  /\bnote\s+this\s+(down\b)?/i,
  /^from\s+now\s+on\b/i,
  /\bactually\b/i,
  /\b(that'?s|this\s+is)\s+wrong\b/i,
  /^correction\b/i,
  /^remember:\s*/i,
];

export const useAgentMemoryStore = create<AgentMemoryState>((set, get) => ({
  memories: [],
  loading: false,
  error: null,
  autoCapture: true,

  init: async (projectId: string, workspaceId: string) => {
    await get().loadMemories(projectId, workspaceId);
    await get().loadAutoCapture();
  },

  loadAutoCapture: async () => {
    try {
      const raw = await api.configGet('memory.autoCapture');
      set({ autoCapture: raw === null ? true : raw !== 'false' });
    } catch {
      set({ autoCapture: true });
    }
  },

  setAutoCapture: async (enabled: boolean) => {
    set({ autoCapture: enabled });
    try {
      await api.configSet('memory.autoCapture', enabled ? 'true' : 'false');
    } catch {}
  },

  loadMemories: async (projectId: string, workspaceId: string) => {
    set({ loading: true, error: null });
    try {
      const list = await api.memoryList(workspaceId, projectId || undefined);
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
    // Memory is deduped on (workspace, project, type, key). Never allow an
    // empty key to collide, or distinct facts silently overwrite each other.
    const derivedKey =
      entry.key.trim() ||
      entry.value.replace(/\s+/g, ' ').trim().split(/[.!?]/)[0].slice(0, 60) ||
      'unnamed';
    const fullEntry: MemoryEntry = {
      ...entry,
      key: derivedKey,
      id: newId(),
      created_at: nowStr(),
      updated_at: nowStr(),
    };
    try {
      const saved = await api.memorySet(fullEntry);
      set(s => {
        const existing = s.memories.some(m => m.id === saved.id);
        const others = s.memories.filter(m => !(m.type === saved.type && m.key === saved.key));
        return { memories: existing ? others.concat([saved]) : [...others, saved] };
      });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  updateMemory: async (id: string, value: string) => {
    try {
      await api.memoryUpdate(id, value);
      set(s => ({
        memories: s.memories.map(m => m.id === id ? { ...m, value, updated_at: nowStr() } : m)
      }));
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  deleteMemory: async (id: string) => {
    try {
      await api.memoryDelete(id);
      set(s => ({ memories: s.memories.filter(m => m.id !== id) }));
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  confirmMemory: async (id: string, value?: string) => {
    const m = get().memories.find(x => x.id === id);
    if (!m) return;
    try {
      await api.memoryUpdate(id, value ?? m.value, m.context, 'user-confirmed', m.confidence);
      set(s => ({
        memories: s.memories.map(x => x.id === id
          ? { ...x, source: 'user-confirmed' as const, value: value ?? x.value }
          : x),
      }));
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  captureFromChat: async ({ userText, projectId, workspaceId, sessionId }) => {
    if (!get().autoCapture) return null;
    const trimmed = userText.trim();
    if (!trimmed) return null;
    const hit = TRIGGER_PATTERNS.some(p => p.test(trimmed));
    if (!hit) return null;

    // Strip the trigger to isolate the core fact the user is stating/correcting.
    const fact = trimmed
      .replace(/^remember\s+(this|that|to)\s*:?\s*/i, '')
      .replace(/^note\s+this\s+(down\s*)?:?\s*/i, '')
      .replace(/^from\s+now\s+on\s*:?\s*/i, '')
      .replace(/\bactually\b\s*:?\s*/i, '')
      .replace(/\b(that'?s|this\s+is)\s+wrong\b\s*:?\s*/i, '')
      .replace(/^correction\s*:?\s*/i, '')
      .trim();
    const value = fact || trimmed;
    const key = value.split(/[.!?]/)[0].slice(0, 80) || 'remembered note';

    const entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at'> = {
      project_id: projectId,
      workspace_id: workspaceId,
      type: 'decisions',
      key,
      value,
      context: 'Captured from chat',
      source: 'ai-inferred',
      confidence: 0.6,
      origin_session_id: sessionId,
    };
    await get().setMemory(entry);
    return entry;
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

// When the backend auto-saves candidate memories after an agent run (FR-1),
// refresh the store if it belongs to the currently active project.
onEvent<{ project_id: string; workspace_id: string }>('memory:candidates', (payload) => {
  const ws = useWorkspaceStore.getState();
  if (
    payload.workspace_id === ws.activeWorkspaceId &&
    payload.project_id === ws.activeProjectId
  ) {
    useAgentMemoryStore.getState().loadMemories(payload.project_id, payload.workspace_id).catch(() => {});
  }
});