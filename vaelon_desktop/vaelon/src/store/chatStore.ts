import { create } from 'zustand';
import { api, ChatSession, ChatMessage, LlmSettings, ModelInfo, onEvent } from '../ipc/client';

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  models: ModelInfo[];
  settings: LlmSettings | null;
  loading: boolean;
  streamingSessionId: string | null;
  error: string | null;

  init: (workspaceId: string) => Promise<() => void>;
  loadSessions: (workspaceId: string) => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  createSession: (workspaceId: string, projectId: string) => Promise<void>;
  sendMessage: (content: string, workspaceContext?: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: LlmSettings) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  models: [],
  settings: null,
  loading: false,
  streamingSessionId: null,
  error: null,

  init: async (workspaceId: string) => {
    await get().loadSettings();
    await get().loadSessions(workspaceId);

    // Setup event listeners for LLM streaming
    const unsubChunk = onEvent<{ session_id: string; content: string }>(
      'llm:chunk',
      (payload) => {
        const { session_id, content } = payload;
        if (session_id === get().activeSessionId) {
          set((state) => {
            const nextMessages = [...state.messages];
            const last = nextMessages[nextMessages.length - 1];
            if (last && last.role === 'assistant') {
              nextMessages[nextMessages.length - 1] = {
                ...last,
                content: last.content + content,
              };
            } else {
              nextMessages.push({
                id: Math.random().toString(),
                session_id,
                role: 'assistant',
                content,
                metadata: {},
                created_at: new Date().toISOString(),
              });
            }
            return { messages: nextMessages, streamingSessionId: session_id };
          });
        }
      }
    );

    const unsubDone = onEvent<{ session_id: string; full_content: string }>(
      'llm:done',
      (payload) => {
        const { session_id } = payload;
        if (session_id === get().activeSessionId) {
          set({ streamingSessionId: null });
          // Reload messages from DB to get actual ID and exact content
          get().selectSession(session_id);
        }
      }
    );

    return () => {
      unsubChunk();
      unsubDone();
    };
  },

  loadSessions: async (workspaceId: string) => {
    set({ loading: true, error: null });
    try {
      const list = await api.chatSessionList(workspaceId);
      set({ sessions: list, loading: false });
      if (list.length > 0 && !get().activeSessionId) {
        await get().selectSession(list[0].id);
      }
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  selectSession: async (id: string) => {
    set({ activeSessionId: id, loading: true, error: null });
    try {
      const msgs = await api.chatMessagesList(id);
      set({ messages: msgs, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  createSession: async (workspaceId: string, projectId: string) => {
    set({ loading: true, error: null });
    try {
      const s = await api.chatSessionCreate(workspaceId, projectId);
      const list = await api.chatSessionList(workspaceId);
      set({ sessions: list, activeSessionId: s.id, messages: [], loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  sendMessage: async (content: string, workspaceContext?: string) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;

    // Instantly append user message to UI
    const tempUserMsg: ChatMessage = {
      id: Math.random().toString(),
      session_id: sessionId,
      role: 'user',
      content,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, tempUserMsg],
    }));

    try {
      await api.chatSend(sessionId, content, workspaceContext);
      // Assistant message will stream in via the llm:chunk event listener
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  loadSettings: async () => {
    try {
      const settings = await api.llmSettingsGet();
      const models = await api.llmModels();
      set({ settings, models });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  updateSettings: async (settings: LlmSettings) => {
    try {
      await api.llmSettingsSet(settings);
      set({ settings });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },
}));
