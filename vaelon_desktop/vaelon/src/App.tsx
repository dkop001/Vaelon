import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import TopBar from './components/workspace/TopBar';
import Sidebar from './components/workspace/Sidebar';
import AIPanel from './components/workspace/AIPanel';
import StatusBar from './components/workspace/StatusBar';
import CommandPalette from './components/workspace/CommandPalette';
import SettingsPanel from './components/workspace/SettingsPanel';
import AgentMode from './features/agent/AgentMode';
import HomeDashboard from './features/search/HomeDashboard';
import SearchPage from './features/search/SearchPage';
import DocumentWorkspace from './features/editor/DocumentWorkspace';
import { useAppStore } from './store/appStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useDocumentStore, DocumentType } from './store/noteStore';
import { useChatStore } from './store/chatStore';
import { useTerminalStore } from './store/terminalStore';
import { useAgentStore } from './store/agentStore';


function AppContent() {
  const { activeView, setActiveView, rightPanelOpen, sidebarCollapsed, activeMode } = useAppStore();
  const { activeWorkspaceId, activeProjectId, init: initWorkspaces } = useWorkspaceStore();
  const { documents, activeDocumentId, createDocument, deleteDocument, selectDocument } = useDocumentStore();
  const [showSettings, setShowSettings] = useState(false);

  // ── Init Workspace State on Mount ──────────────────────────────────────────
  useEffect(() => {
    initWorkspaces();
  }, []);

  // ── Load Documents when Workspace or Project changes ───────────────────────
  useEffect(() => {
    if (activeWorkspaceId) {
      useDocumentStore.getState().loadDocuments(activeWorkspaceId, activeProjectId || undefined);
    }
  }, [activeWorkspaceId, activeProjectId]);

  // ── Init Chat, Terminal, and Agent Listeners on Workspace Load ─────────────
  useEffect(() => {
    if (activeWorkspaceId) {
      let unsubChatPromise = useChatStore.getState().init(activeWorkspaceId);
      const unsubTerm = useTerminalStore.getState().init();
      const unsubAgent = useAgentStore.getState().init();

      return () => {
        unsubChatPromise.then((unsub) => unsub());
        unsubTerm();
        unsubAgent();
      };
    }
  }, [activeWorkspaceId]);

  // ── Active Document Selection Helper ───────────────────────────────────────
  const activeDocument = documents.find((d) => d.id === activeDocumentId);

  const handleCreateDocument = async (type: DocumentType = 'knowledge') => {
    if (activeWorkspaceId && activeProjectId) {
      await createDocument(activeWorkspaceId, activeProjectId, 'Untitled Document', type);
      setActiveView('documents');
    }
  };

  const handleSelectDocument = (id: string) => {
    selectDocument(id);
    setActiveView('documents');
  };

  const handleDeleteDocument = async (id: string) => {
    await deleteDocument(id);
    if (activeDocumentId === id) {
      const remaining = documents.filter((d) => d.id !== id);
      if (remaining.length > 0) {
        selectDocument(remaining[0].id);
      } else {
        selectDocument(null);
        setActiveView('home');
      }
    }
  };

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${rightPanelOpen ? 'has-right-panel' : ''} ${activeMode === 'agent' ? 'agent-mode-active' : ''}`}>
      
      {/* ── Top Bar ── */}
      <div className="workspace-topbar">
        <TopBar documentTitle={activeDocument?.title} onSettingsOpen={() => setShowSettings(true)} />
      </div>

      {/* ── Sidebar (Knowledge Mode Only) ── */}
      {activeMode !== 'agent' && (
        <div className="workspace-sidebar">
          <Sidebar
            onNewDocument={handleCreateDocument}
            onDeleteDocument={handleDeleteDocument}
            onSelectDocument={handleSelectDocument}
            loadingDocuments={false}
          />
        </div>
      )}

      {/* ── Main Panel Content ── */}
      <div className="workspace-main">
        {activeMode === 'agent' ? (
          <AgentMode />
        ) : (
          <>
            {activeView === 'home' && (
              <HomeDashboard onNewNote={handleCreateDocument} />
            )}

            {activeView === 'documents' && (
              <DocumentWorkspace
                onStatsChange={() => {}}
              />
            )}

            {activeView === 'search' && (
              <SearchPage />
            )}

            {activeView === 'projects' && (
              <div className="page-placeholder">Projects View - Coming Soon</div>
            )}

            {activeView === 'tasks' && (
              <div className="page-placeholder">Tasks View - Coming Soon</div>
            )}

            {activeView === 'research' && (
              <div className="page-placeholder">Research View - Coming Soon</div>
            )}

            {activeView === 'git' && (
              <div className="page-placeholder">Git View - Coming Soon</div>
            )}

            {activeView === 'builds' && (
              <div className="page-placeholder">Builds View - Coming Soon</div>
            )}

            {activeView === 'terminal' && (
              <div className="page-placeholder">Terminal View - Coming Soon</div>
            )}
          </>
        )}
      </div>

      {/* ── Right AI Panel & Statusbar (Knowledge Mode Only) ── */}
      {activeMode !== 'agent' && (
        <>
          <div className="workspace-right-panel">
            <AIPanel />
          </div>

          <div className="workspace-statusbar">
            <StatusBar
              wordCount={activeDocument?.content ? activeDocument.content.split(/\s+/).filter(Boolean).length : 0}
              charCount={activeDocument?.content ? activeDocument.content.length : 0}
            />
          </div>
        </>
      )}

      {/* ── Command Palette ── */}
      <CommandPalette onNewDocument={handleCreateDocument} />

      {/* ── Settings Panel Modal ── */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
