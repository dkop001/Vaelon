import { create } from 'zustand';

export type RightPanelTab = 'chat' | 'summary' | 'intel' | 'context' | 'preview' | 'agent';

export interface BackgroundServices {
  indexer: 'inactive' | 'active' | 'error' | 'starting';
  gitWatcher: 'inactive' | 'active' | 'error' | 'starting';
  buildWatcher: 'inactive' | 'active' | 'error' | 'starting';
  agent: 'inactive' | 'active' | 'error' | 'starting';
}

export type ActiveView = 'home' | 'documents' | 'projects' | 'terminal' | 'search' | 'settings' | 'chatHistory' | 'graph' | 'timeline' | 'memory' | 'agent';

interface AppState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab?: RightPanelTab) => void;
  cmdOpen: boolean;
  openCmd: () => void;
  closeCmd: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  sidebarMode: 'nav' | 'chatHistory';
  setSidebarMode: (mode: 'nav' | 'chatHistory') => void;
  activeMode: 'knowledge' | 'agent';
  setActiveMode: (mode: 'knowledge' | 'agent') => void;
  syncState: 'synced' | 'syncing' | 'offline';
  setSyncState: (state: 'synced' | 'syncing' | 'offline') => void;
  backgroundServices: BackgroundServices;
  setBackgroundService: (service: keyof BackgroundServices, status: BackgroundServices[keyof BackgroundServices]) => void;
  activeProjectPath: string | null;
  setActiveProjectPath: (path: string | null) => void;
  previewFilePath: string | null;
  setPreviewFilePath: (path: string | null) => void;
  previewFileName: string | null;
  setPreviewFileName: (name: string | null) => void;
  memoryAddSignal: number;
  triggerMemoryAdd: () => void;
  consumeMemoryAdd: () => number;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  setTheme: (t) => {
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  rightPanelOpen: false,
  rightPanelTab: 'context',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  openRightPanel: (tab = 'context') => set({ rightPanelOpen: true, rightPanelTab: tab }),
  cmdOpen: false,
  openCmd: () => set({ cmdOpen: true }),
  closeCmd: () => set({ cmdOpen: false }),
  activeView: 'home',
  setActiveView: (v) => set({ activeView: v, sidebarMode: 'nav' }),
  sidebarMode: 'nav',
  setSidebarMode: (m) => set({ sidebarMode: m }),
  activeMode: 'knowledge',
  setActiveMode: (mode) => set({ activeMode: mode }),
  syncState: 'synced',
  setSyncState: (s) => set({ syncState: s }),
  backgroundServices: {
    indexer: 'inactive',
    gitWatcher: 'inactive',
    buildWatcher: 'inactive',
    agent: 'inactive',
  },
  setBackgroundService: (service, status) =>
    set((s) => ({
      backgroundServices: { ...s.backgroundServices, [service]: status },
    })),
  activeProjectPath: null,
  setActiveProjectPath: (path) => set({ activeProjectPath: path }),
  previewFilePath: null,
  setPreviewFilePath: (path) => set({ previewFilePath: path }),
  previewFileName: null,
  setPreviewFileName: (name) => set({ previewFileName: name }),
  memoryAddSignal: 0,
  triggerMemoryAdd: () => { set((s) => ({ memoryAddSignal: s.memoryAddSignal + 1, activeView: 'memory', sidebarMode: 'nav' })); },
  consumeMemoryAdd: () => {
    const v = get().memoryAddSignal;
    set({ memoryAddSignal: 0 });
    return v;
  },
}));
