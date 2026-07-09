import { create } from 'zustand';
import { api, onEvent } from '../ipc/client';

export interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  command?: string;
  path?: string;
}

export interface AgentObservation {
  text: string;
  success: boolean;
  timestamp: string;
}

interface AgentState {
  runId: string | null;
  goal: string;
  status: 'idle' | 'planning' | 'running' | 'blocked' | 'completed' | 'failed';
  tasks: AgentTask[];
  observations: AgentObservation[];
  filesCreatedCount: number;
  filesModifiedCount: number;
  actionsCompletedCount: number;
  errorCount: number;
  blockedActionId: string | null;
  blockedReason: string | null;
  loading: boolean;

  init: () => () => void;
  startAgent: (goal: string, workspacePath: string) => Promise<void>;
  stopAgent: () => Promise<void>;
  approveAction: () => Promise<void>;
  clearState: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runId: null,
  goal: '',
  status: 'idle',
  tasks: [],
  observations: [],
  filesCreatedCount: 0,
  filesModifiedCount: 0,
  actionsCompletedCount: 0,
  errorCount: 0,
  blockedActionId: null,
  blockedReason: null,
  loading: false,

  init: () => {
    const unsubStarted = onEvent<{ run_id: string; goal: string }>(
      'agent:reasoning_started',
      (payload) => {
        set({
          runId: payload.run_id,
          goal: payload.goal,
          status: 'running',
          tasks: [],
          observations: [],
        });
      }
    );

    const unsubAction = onEvent<{ run_id: string; action: any }>(
      'agent:action_created',
      (payload) => {
        const { action } = payload;
        set((state) => {
          // If task already exists, update status
          const idx = state.tasks.findIndex((t) => t.id === action.id);
          const updatedTasks = [...state.tasks];
          const taskObj: AgentTask = {
            id: action.id,
            description: action.description || 'Reasoning step',
            status: 'running',
            command: action.command,
            path: action.path,
          };
          if (idx !== -1) {
            updatedTasks[idx] = taskObj;
          } else {
            updatedTasks.push(taskObj);
          }
          return { tasks: updatedTasks, status: 'running' };
        });
      }
    );

    const unsubObservation = onEvent<{ run_id: string; observation: string; success: boolean }>(
      'agent:observation',
      (payload) => {
        set((state) => {
          // Update the last running task to completed or failed
          const updatedTasks = state.tasks.map((t) =>
            t.status === 'running'
              ? { ...t, status: payload.success ? ('completed' as const) : ('failed' as const) }
              : t
          );
          return {
            tasks: updatedTasks,
            observations: [
              ...state.observations,
              {
                text: payload.observation,
                success: payload.success,
                timestamp: new Date().toLocaleTimeString(),
              },
            ],
          };
        });
      }
    );

    const unsubBlocked = onEvent<{ run_id: string; action_id: string; reason: string; requires_approval: boolean }>(
      'agent:tool_blocked',
      (payload) => {
        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.id === payload.action_id ? { ...t, status: 'blocked' as const } : t
          );
          return {
            tasks: updatedTasks,
            status: 'blocked',
            blockedActionId: payload.action_id,
            blockedReason: payload.reason,
          };
        });
      }
    );

    const unsubCompleted = onEvent<{
      run_id: string;
      goal: string;
      files_created: number;
      files_modified: number;
      actions_completed: number;
      errors: number;
      status: string;
    }>('agent:goal_completed', (payload) => {
      set({
        status: 'completed',
        filesCreatedCount: payload.files_created,
        filesModifiedCount: payload.files_modified,
        actionsCompletedCount: payload.actions_completed,
        errorCount: payload.errors,
      });
    });

    const unsubFailed = onEvent<{ run_id: string; reason: string }>('agent:failed', (_payload) => {
      set({ status: 'failed' });
    });

    return () => {
      unsubStarted();
      unsubAction();
      unsubObservation();
      unsubBlocked();
      unsubCompleted();
      unsubFailed();
    };
  },

  startAgent: async (goal: string, workspacePath: string) => {
    set({ loading: true, status: 'planning' });
    try {
      const runId = await api.agentStart(goal, workspacePath);
      set({ runId, goal, status: 'running', loading: false });
    } catch (err: any) {
      set({ status: 'failed', loading: false });
    }
  },

  stopAgent: async () => {
    const runId = get().runId;
    if (!runId) return;
    try {
      await api.agentStop(runId);
      set({ status: 'idle', runId: null });
    } catch {}
  },

  approveAction: async () => {
    const actionId = get().blockedActionId;
    if (!actionId) return;
    try {
      await api.agentApprove(actionId);
      set({ blockedActionId: null, blockedReason: null, status: 'running' });
    } catch {}
  },

  clearState: () => {
    set({
      runId: null,
      goal: '',
      status: 'idle',
      tasks: [],
      observations: [],
      filesCreatedCount: 0,
      filesModifiedCount: 0,
      actionsCompletedCount: 0,
      errorCount: 0,
      blockedActionId: null,
      blockedReason: null,
    });
  },
}));
