import { useEffect, useState } from 'react';
import TopBar from './components/workspace/TopBar';
import Sidebar from './components/workspace/Sidebar';
import AIPanel from './components/workspace/AIPanel';
import StatusBar from './components/workspace/StatusBar';
import CommandPalette from './components/workspace/CommandPalette';
import SettingsPanel from './components/workspace/SettingsPanel';
import AgentMode from './features/agent/AgentMode';
import MissionControl from './features/mission-control/MissionControl';
import ProjectsView from './features/projects/ProjectsView';
import MemoryView from './features/memory/MemoryView';
import GraphView from './features/graph/GraphView';
import TimelineView from './features/timeline/TimelineView';
import SearchPage from './features/search/SearchPage';
import DocumentWorkspace from './features/editor/DocumentWorkspace';
import TerminalView from './features/terminal/TerminalView';
import { useAppStore } from './store/appStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useDocumentStore, DocumentType } from './store/noteStore';
import { useChatStore } from './store/chatStore';
import { useTerminalStore } from './store/terminalStore';
import { useAgentStore } from './store/agentStore';

function AppContent() {
  const { activeView, setActiveView, rightPanelOpen, sidebarCollapsed, activeMode } = useAppStore();
  const { activeWorkspaceId, activeProjectId, init: initWorkspaces } = useWorkspaceStore();
  const { documents, activeDocumentId, createDocument } = useDocumentStore();
  const [showSettings, setShowSettings] = useState(false);

  // ── Init Workspace State on Mount ──────────────────────────────────────────
  useEffect(() => {
    initWorkspaces().catch((err: any) => {
      console.error('Failed to init workspaces:', err);
    });
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
      const unsubAgent = useAgentStore.getState().init();

      return () => {
        unsubChatPromise.then((unsub) => unsub());
        unsubAgent();
      };
    }
  }, [activeWorkspaceId]);

  // ── Init Terminal Listeners Once ──────────────────────────────────────────
  useEffect(() => {
    const unsubTerm = useTerminalStore.getState().init();
    return () => unsubTerm();
  }, []);

  // ── Active Document Selection Helper ───────────────────────────────────────
  const activeDocument = documents.find((d) => d.id === activeDocumentId);

  const handleCreateDocument = async (type: DocumentType = 'knowledge') => {
    if (activeWorkspaceId && activeProjectId) {
      await createDocument(activeWorkspaceId, activeProjectId, 'Untitled Document', type);
      setActiveView('documents');
    }
  };

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${rightPanelOpen ? 'has-right-panel' : ''} ${activeMode === 'agent' ? 'agent-mode-active' : ''}`}>

      {/* ── Top Bar ── */}
      <div className="workspace-topbar">
        <TopBar documentTitle={activeDocument?.title} onSettingsOpen={() => setShowSettings(true)} />
      </div>

      {/* ── Sidebar ── */}
      {activeMode !== 'agent' && (
        <div className="workspace-sidebar">
          <Sidebar
            onNewDocument={handleCreateDocument}
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
              <MissionControl />
            )}

            {activeView === 'agent' && (
              <AgentMode />
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
              <ProjectsView />
            )}

            {activeView === 'memory' && (
              <MemoryView />
            )}

            {activeView === 'graph' && (
              <GraphView />
            )}

            {activeView === 'timeline' && (
              <TimelineView />
            )}

{activeView === 'terminal' && (
  <TerminalView />
)}
          </>
        )}
      </div>

      {/* ── Right AI Panel & Statusbar ── */}
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
  return <AppContent />;
}
