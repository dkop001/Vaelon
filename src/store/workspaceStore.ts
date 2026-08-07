import { create } from 'zustand';
import { api, Workspace, Project, ProjectMeta } from '../ipc/client';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  projects: Project[];
  activeProjectId: string | null;
  projectMeta: ProjectMeta | null;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string, path: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<void>;

  selectProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  loadProjectMeta: (projectId: string) => Promise<void>;
  setProjectMeta: (meta: ProjectMeta) => Promise<void>;
  getActiveProject: () => Project | null;
  getActiveWorkspace: () => Workspace | null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  projects: [],
  activeProjectId: null,
  projectMeta: null,
  loading: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });
    try {
      const list = await api.workspaceList();
      set({ workspaces: list, loading: false });
      if (list.length > 0) {
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
        get().loadProjectMeta(defaultProj.id).catch(() => {});
      } else {
        set({ activeProjectId: null, projectMeta: null });
      }
      // Start background intelligence services for this workspace (Phase 3).
      const ws = get().workspaces.find((w) => w.id === id);
      if (ws?.path) {
        api.servicesStart(id, ws.path).catch(() => {});
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

  updateWorkspace: async (id: string, updates: Partial<Workspace>) => {
    const ws = get().workspaces.find(w => w.id === id);
    if (!ws) return;
    const updated = { ...ws, ...updates, updated_at: new Date().toISOString() };
    // Backend doesn't have update command yet, store locally
    set({ workspaces: get().workspaces.map(w => w.id === id ? updated : w) });
  },

  selectProject: async (id: string) => {
    set({ activeProjectId: id });
    await get().loadProjectMeta(id).catch(() => {});
  },

  loadProjectMeta: async (projectId: string) => {
    try {
      const meta = await api.projectMetaGet(projectId);
      set({ projectMeta: meta });
    } catch {
      set({ projectMeta: null });
    }
  },

  setProjectMeta: async (meta: ProjectMeta) => {
    try {
      const saved = await api.projectMetaSet(meta);
      set({ projectMeta: saved });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  createProject: async (name: string, description?: string) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    set({ loading: true, error: null });
    try {
      const project = await api.projectCreate(wsId, name);
      if (description) {
        await get().updateProject(project.id, { description });
      }
      const pList = await api.projectList(wsId);
      set({ projects: pList, loading: false, activeProjectId: project.id });
      get().loadProjectMeta(project.id).catch(() => {});
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
          get().loadProjectMeta(pList[0].id).catch(() => {});
        } else {
          set({ activeProjectId: null, projectMeta: null });
        }
      }
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.toString(), loading: false });
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    const project = get().projects.find(p => p.id === id);
    if (!project) return;
    const updated = { ...project, ...updates, updated_at: new Date().toISOString() };
    try {
      await api.projectUpdate(updated);
      set({ projects: get().projects.map(p => p.id === id ? updated : p) });
      if (get().activeProjectId === id) {
        set({ activeProjectId: updated.id });
      }
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find(p => p.id === activeProjectId) || null;
  },

  getActiveWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find(w => w.id === activeWorkspaceId) || null;
  },
}));
