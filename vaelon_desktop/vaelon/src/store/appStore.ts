import { create } from 'zustand';

interface AppState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  rightPanelOpen: boolean;
  rightPanelTab: 'chat' | 'summary' | 'quiz';
  setRightPanelTab: (tab: 'chat' | 'summary' | 'quiz') => void;
  toggleRightPanel: () => void;
  openRightPanel: (tab?: 'chat' | 'summary' | 'quiz') => void;
  cmdOpen: boolean;
  openCmd: () => void;
  closeCmd: () => void;
  activeView: 'home' | 'notes' | 'study' | 'search' | 'settings' | 'chatHistory';
  setActiveView: (view: 'home' | 'notes' | 'study' | 'search' | 'settings' | 'chatHistory') => void;
  sidebarMode: 'nav' | 'chatHistory';
  setSidebarMode: (mode: 'nav' | 'chatHistory') => void;
  activeMode: 'knowledge' | 'agent';
  setActiveMode: (mode: 'knowledge' | 'agent') => void;
  syncState: 'synced' | 'syncing' | 'offline';
  setSyncState: (state: 'synced' | 'syncing' | 'offline') => void;
  mobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
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
  rightPanelTab: 'chat',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  openRightPanel: (tab = 'chat') => set({ rightPanelOpen: true, rightPanelTab: tab }),
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
  mobileSidebarOpen: false,
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
}));
