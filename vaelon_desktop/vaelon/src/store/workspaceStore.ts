import { create } from 'zustand';
import { api, Workspace, Project } from '../ipc/client';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string, path: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  selectProject: (id: string) => void;
  createProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const list = await api.workspaceList();
      set({ workspaces: list, loading: false });
      if (list.length > 0) {
        // Auto-select first workspace (usually 'default')
        const defaultWs = list.find((w) => w.id === 'default') || list[0];
        await get().selectWorkspace(defaultWs.id);
      }
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  selectWorkspace: async (id: string) => {
    set({ activeWorkspaceId: id, loading: true, error: null });
    try {
      const pList = await api.projectList(id);
      set({ projects: pList, loading: false });
      if (pList.length > 0) {
        const defaultProj = pList.find((p) => p.id === 'default') || pList[0];
        set({ activeProjectId: defaultProj.id });
      } else {
        set({ activeProjectId: null });
      }
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  createWorkspace: async (name: string, path: string) => {
    set({ loading: true, error: null });
    try {
      await api.workspaceCreate(name, path);
      const list = await api.workspaceList();
      set({ workspaces: list, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  deleteWorkspace: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await api.workspaceDelete(id);
      const list = await api.workspaceList();
      set({ workspaces: list });
      if (get().activeWorkspaceId === id) {
        if (list.length > 0) {
          await get().selectWorkspace(list[0].id);
        } else {
          set({ activeWorkspaceId: null, projects: [], activeProjectId: null });
        }
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  selectProject: (id: string) => {
    set({ activeProjectId: id });
  },

  createProject: async (name: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    set({ loading: true, error: null });
    try {
      await api.projectCreate(wsId, name);
      const pList = await api.projectList(wsId);
      set({ projects: pList, loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  deleteProject: async (id: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    set({ loading: true, error: null });
    try {
      await api.projectDelete(id);
      const pList = await api.projectList(wsId);
      set({ projects: pList });
      if (get().activeProjectId === id) {
        if (pList.length > 0) {
          set({ activeProjectId: pList[0].id });
        } else {
          set({ activeProjectId: null });
        }
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },
}));
