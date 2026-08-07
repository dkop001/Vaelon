import { create } from 'zustand';
import { api, onEvent } from '../ipc/client';

interface TerminalSessionState {
  id: string | null;
  output: string;
  isAlive: boolean;
}

interface TerminalState {
  sessions: Record<string, TerminalSessionState>;
  activeSessionId: string | null;
  loading: boolean;
  error: string | null;

  init: () => () => void;
  spawnSession: (shell?: string, cwd?: string) => Promise<string>;
  writeToSession: (id: string, data: string) => Promise<void>;
  resizeSession: (id: string, cols: number, rows: number) => Promise<void>;
  killSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
}

export const useTerminalStore = create<TerminalState>((set, _get) => ({
  sessions: {},
  activeSessionId: null,
  loading: false,
  error: null,

  init: () => {
    // Setup event listeners for PTY stdout streaming
    const unsubOutput = onEvent<{ id: string; data: string }>(
      'terminal:output',
      (payload) => {
        const { id, data } = payload;
        set((state) => {
          const session = state.sessions[id];
          if (!session) return {};
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                output: session.output + data,
              },
            },
          };
        });
      }
    );

    const unsubExit = onEvent<{ id: string; code: number }>(
      'terminal:exit',
      (payload) => {
        const { id } = payload;
        set((state) => {
          const session = state.sessions[id];
          if (!session) return {};
          return {
            sessions: {
              ...state.sessions,
              [id]: {
                ...session,
                isAlive: false,
              },
            },
          };
        });
      }
    );

    return () => {
      unsubOutput();
      unsubExit();
    };
  },

  spawnSession: async (shell?: string, cwd?: string) => {
    set({ loading: true, error: null });
    try {
      const id = await api.terminalSpawn(shell, cwd);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [id]: {
            id,
            output: '',
            isAlive: true,
          },
        },
        activeSessionId: id,
        loading: false,
      }));
      return id;
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
      throw err;
    }
  },

  writeToSession: async (id: string, data: string) => {
    try {
      await api.terminalWrite(id, data);
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  resizeSession: async (id: string, cols: number, rows: number) => {
    try {
      await api.terminalResize(id, cols, rows);
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  killSession: async (id: string) => {
    try {
      await api.terminalKill(id);
      set((state) => {
        const nextSessions = { ...state.sessions };
        delete nextSessions[id];
        let nextActive = state.activeSessionId;
        if (nextActive === id) {
          const keys = Object.keys(nextSessions);
          nextActive = keys.length > 0 ? keys[0] : null;
        }
        return {
          sessions: nextSessions,
          activeSessionId: nextActive,
        };
      });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  setActiveSession: (id: string | null) => {
    set({ activeSessionId: id });
  },
}));
