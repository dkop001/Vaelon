import { useEffect, useState, useCallback } from 'react';
import TopBar from './components/workspace/TopBar';
import Sidebar from './components/workspace/Sidebar';
import AIPanel from './components/workspace/AIPanel';
import StatusBar from './components/workspace/StatusBar';
import CommandPalette from './components/workspace/CommandPalette';
import SettingsPanel from './components/workspace/SettingsPanel';
import SplashScreen from './components/ui/SplashScreen';
import OnboardingWizard from './components/ui/OnboardingWizard';
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
  const { activeView, setActiveView, rightPanelOpen, sidebarCollapsed, activeMode, onboardingComplete } = useAppStore();
  const { activeWorkspaceId, activeProjectId, init: initWorkspaces, workspaces } = useWorkspaceStore();
  const { documents, activeDocumentId, createDocument } = useDocumentStore();
  const [showSettings, setShowSettings] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(onboardingComplete);

  // ── ALL hooks must be declared unconditionally before any returns ──────────

  useEffect(() => {
    initWorkspaces()
      .then(() => setTimeout(() => setSplashDone(true), 600))
      .catch(() => setSplashDone(true));
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      useDocumentStore.getState().loadDocuments(activeWorkspaceId, activeProjectId || undefined);
    }
  }, [activeWorkspaceId, activeProjectId]);

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

  useEffect(() => {
    const unsubTerm = useTerminalStore.getState().init();
    return () => unsubTerm();
  }, []);

  const handleSplashComplete = useCallback(() => {
    setSplashDone(true);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingDone(true);
  }, []);

  const activeDocument = documents.find((d) => d.id === activeDocumentId);

  const handleCreateDocument = async (type: DocumentType = 'knowledge') => {
    if (activeWorkspaceId && activeProjectId) {
      await createDocument(activeWorkspaceId, activeProjectId, 'Untitled Document', type);
      setActiveView('documents');
    }
  };

  // ── Now safe to conditionally render ────────────────────────────────────────

  if (!splashDone) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!onboardingDone && workspaces.length === 0) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

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
      <main className="workspace-main" role="main" aria-label="Main content">
        {activeMode === 'agent' ? (
          <AgentMode />
        ) : (
          <>
            {activeView === 'home' && (
              <div className="animate-fade-in"><MissionControl /></div>
            )}

            {activeView === 'agent' && (
              <div className="animate-fade-in"><AgentMode /></div>
            )}

            {activeView === 'documents' && (
              <div className="animate-fade-in">
                <DocumentWorkspace
                  onStatsChange={() => {}}
                />
              </div>
            )}

            {activeView === 'search' && (
              <div className="animate-fade-in"><SearchPage /></div>
            )}

            {activeView === 'projects' && (
              <div className="animate-fade-in"><ProjectsView /></div>
            )}

            {activeView === 'memory' && (
              <div className="animate-fade-in"><MemoryView /></div>
            )}

            {activeView === 'graph' && (
              <div className="animate-fade-in"><GraphView /></div>
            )}

            {activeView === 'timeline' && (
              <div className="animate-fade-in"><TimelineView /></div>
            )}

            {activeView === 'terminal' && (
              <div className="animate-fade-in"><TerminalView /></div>
            )}
          </>
        )}
      </main>

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
