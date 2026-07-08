import { create } from 'zustand';

/**
 * useAppStore — global UI state (theme, panels, command palette, active view)
 */
export const useAppStore = create((set, get) => ({
  // Theme
  theme: localStorage.getItem('noteai-theme') || 'dark',
  setTheme: (t) => {
    localStorage.setItem('noteai-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // Right AI panel
  rightPanelOpen: false,
  rightPanelTab: 'chat', // 'chat' | 'summary' | 'quiz'
  setRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  openRightPanel: (tab = 'chat') => set({ rightPanelOpen: true, rightPanelTab: tab }),

  // Command palette
  cmdOpen: false,
  openCmd: () => set({ cmdOpen: true }),
  closeCmd: () => set({ cmdOpen: false }),

  // Active view
  activeView: 'home', // 'home' | 'notes' | 'study' | 'search' | 'settings'
  setActiveView: (v) => set({ activeView: v, sidebarMode: 'nav' }),

  // Sidebar mode: 'nav' | 'chatHistory'
  sidebarMode: 'nav',
  setSidebarMode: (m) => set({ sidebarMode: m }),
  openChatHistory: () => set({ sidebarMode: 'chatHistory' }),
  closeChatHistory: () => set({ sidebarMode: 'nav' }),

  // Chat history panel state
  viewingSessionId: null,
  setViewingSessionId: (id) => set({ viewingSessionId: id }),

  // Mobile sidebar
  mobileSidebarOpen: false,
  toggleMobileSidebar: () => set((s) => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),

  // Sync state
  syncState: 'synced', // 'synced' | 'syncing' | 'offline'
  setSyncState: (s) => set({ syncState: s }),

  // Active mode: 'knowledge' | 'agent'
  activeMode: 'knowledge',
  setActiveMode: (mode) => set({ activeMode: mode }),

  // AI settings
  aiMode: (() => {
    try {
      const raw = localStorage.getItem('flow-ai-settings');
      return raw ? JSON.parse(raw).mode || 'auto' : 'auto';
    } catch { return 'auto'; }
  })(),
  setAiMode: (mode) => {
    const raw = localStorage.getItem('flow-ai-settings');
    const settings = raw ? JSON.parse(raw) : {};
    settings.mode = mode;
    localStorage.setItem('flow-ai-settings', JSON.stringify(settings));
    set({ aiMode: mode });
  },
}));
