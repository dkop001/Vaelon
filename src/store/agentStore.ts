import { create } from 'zustand';
import { api, onEvent } from '../ipc/client';

export interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  command?: string;
  path?: string;
}

export interface ToolCallRecord {
  name: string;
  input: any;
  output: any;
  success: boolean;
  duration_ms: number;
  error?: string;
}

export interface WorldStateSnapshot {
  goal: string;
  workspace_path: string;
  directory_tree: string[];
  created_files: string[];
  modified_files: string[];
  todo: string[];
  completed: string[];
  failed: string[];
  current_focus: string;
}

interface AgentState {
  runId: string | null;
  goal: string;
  status: 'idle' | 'planning' | 'running' | 'blocked' | 'completed' | 'failed';
  tasks: AgentTask[];
  toolCalls: ToolCallRecord[];
  filesCreatedCount: number;
  filesModifiedCount: number;
  tasksTotal: number;
  tasksFailed: number;
  errorCount: number;
  worldState: WorldStateSnapshot | null;
  currentFocus: string;
  blockedActionId: string | null;
  blockedReason: string | null;
  loading: boolean;

  init: () => () => void;
  startAgent: (goal: string, workspacePath: string, projectId?: string, contextOverride?: string, capture?: boolean) => Promise<void>;
  stopAgent: () => Promise<void>;
  approveAction: () => Promise<void>;
  denyAction: () => Promise<void>;
  clearState: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runId: null,
  goal: '',
  status: 'idle',
  tasks: [],
  toolCalls: [],
  filesCreatedCount: 0,
  filesModifiedCount: 0,
  tasksTotal: 0,
  tasksFailed: 0,
  errorCount: 0,
  worldState: null,
  currentFocus: '',
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
          toolCalls: [],
          worldState: null,
        });
      }
    );

    const unsubAction = onEvent<{ run_id: string; action: any; world_state_snapshot: any }>(
      'agent:action_created',
      (payload) => {
        const { action, world_state_snapshot } = payload;
        set((state) => {
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
          return {
            tasks: updatedTasks,
            status: 'running',
            worldState: world_state_snapshot ? {
              goal: world_state_snapshot.goal || '',
              workspace_path: world_state_snapshot.workspace_path || '',
              directory_tree: world_state_snapshot.directory_tree || [],
              created_files: world_state_snapshot.created_files || [],
              modified_files: world_state_snapshot.modified_files || [],
              todo: world_state_snapshot.todo || [],
              completed: world_state_snapshot.completed || [],
              failed: world_state_snapshot.failed || [],
              current_focus: world_state_snapshot.current_focus || action.description || '',
            } : state.worldState,
            currentFocus: world_state_snapshot?.current_focus || action.description || '',
          };
        });
      }
    );

    const unsubObservation = onEvent<{ run_id: string; tool_call: any; success: boolean }>(
      'agent:observation',
      (payload) => {
        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.status === 'running'
              ? { ...t, status: payload.success ? ('completed' as const) : ('failed' as const) }
              : t
          );
          return {
            tasks: updatedTasks,
            toolCalls: [
              ...state.toolCalls,
              {
                name: payload.tool_call?.name || 'unknown',
                input: payload.tool_call?.input || {},
                output: payload.tool_call?.output || {},
                success: payload.success,
                duration_ms: payload.tool_call?.duration_ms || 0,
                error: payload.tool_call?.error,
              },
            ],
          };
        });
      }
    );

    const unsubTaskUpdate = onEvent<{ run_id: string; task_id: string; status: string; description: string }>(
      'agent:task_update',
      (payload) => {
        set((state) => {
          const idx = state.tasks.findIndex((t) => t.id === payload.task_id);
          const updatedTasks = [...state.tasks];
          const taskObj: AgentTask = {
            id: payload.task_id,
            description: payload.description,
            status: payload.status as AgentTask['status'],
          };
          if (idx !== -1) {
            updatedTasks[idx] = taskObj;
          } else {
            updatedTasks.push(taskObj);
          }
          return { tasks: updatedTasks };
        });
      }
    );

    const unsubCompleted = onEvent<{
      run_id: string;
      goal: string;
      files_created: number;
      files_modified: number;
      tasks_total: number;
      tasks_failed: number;
      errors: number;
      status: string;
    }>('agent:goal_completed', (payload) => {
      set({
        status: 'completed',
        filesCreatedCount: payload.files_created,
        filesModifiedCount: payload.files_modified,
        tasksTotal: payload.tasks_total,
        tasksFailed: payload.tasks_failed,
        errorCount: payload.errors,
      });
    });

    const unsubFailed = onEvent<{ run_id: string; reason: string }>('agent:failed', (_payload) => {
      set({ status: 'failed' });
    });

    const unsubBlocked = onEvent<{ run_id: string; action_id: string; reason: string }>(
      'agent:blocked',
      (payload) => {
        set({
          status: 'blocked',
          blockedActionId: payload.action_id,
          blockedReason: payload.reason,
        });
      }
    );

    return () => {
      unsubStarted();
      unsubAction();
      unsubObservation();
      unsubTaskUpdate();
      unsubCompleted();
      unsubFailed();
      unsubBlocked();
    };
  },

  startAgent: async (goal: string, workspacePath: string, projectId?: string, contextOverride?: string, capture?: boolean) => {
    set({ loading: true, status: 'planning' });
    try {
      const runId = await api.agentStart(goal, workspacePath, projectId, contextOverride, capture);
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

  denyAction: async () => {
    const actionId = get().blockedActionId;
    if (!actionId) return;
    try {
      await api.agentDeny(actionId);
      set({ blockedActionId: null, blockedReason: null, status: 'running' });
    } catch {}
  },

  clearState: () => {
    set({
      runId: null,
      goal: '',
      status: 'idle',
      tasks: [],
      toolCalls: [],
      filesCreatedCount: 0,
      filesModifiedCount: 0,
      tasksTotal: 0,
      tasksFailed: 0,
      errorCount: 0,
      worldState: null,
      currentFocus: '',
      blockedActionId: null,
      blockedReason: null,
    });
  },
}));
