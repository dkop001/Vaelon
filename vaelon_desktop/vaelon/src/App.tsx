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
import StudyCenter from './features/study/StudyCenter';
import NoteWorkspace from './features/editor/NoteWorkspace';
import { useAppStore } from './store/appStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useNoteStore } from './store/noteStore';
import { useChatStore } from './store/chatStore';
import { useTerminalStore } from './store/terminalStore';
import { useAgentStore } from './store/agentStore';


function AppContent() {
  const { activeView, setActiveView, rightPanelOpen, sidebarCollapsed, activeMode } = useAppStore();
  const { activeWorkspaceId, activeProjectId, init: initWorkspaces } = useWorkspaceStore();
  const { notes, activeNoteId, createNote, deleteNote, selectNote } = useNoteStore();
  const [showSettings, setShowSettings] = useState(false);

  // ── Init Workspace State on Mount ──────────────────────────────────────────
  useEffect(() => {
    initWorkspaces();
  }, []);

  // ── Load Notes when Workspace or Project changes ──────────────────────────
  useEffect(() => {
    if (activeWorkspaceId) {
      useNoteStore.getState().loadNotes(activeWorkspaceId, activeProjectId || undefined);
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

  // ── Active Note Selection Helper ──────────────────────────────────────────
  const activeNote = notes.find((n) => n.id === activeNoteId);

  const handleCreateNote = async () => {
    if (activeWorkspaceId && activeProjectId) {
      await createNote(activeWorkspaceId, activeProjectId, 'Untitled Note');
      setActiveView('notes');
    }
  };

  const handleSelectNote = (id: string) => {
    selectNote(id);
    setActiveView('notes');
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    if (activeNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        selectNote(remaining[0].id);
      } else {
        selectNote(null);
        setActiveView('home');
      }
    }
  };

  return (
    <div className={`workspace-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${rightPanelOpen ? 'has-right-panel' : ''} ${activeMode === 'agent' ? 'agent-mode-active' : ''}`}>
      
      {/* ── Top Bar ── */}
      <div className="workspace-topbar">
        <TopBar noteTitle={activeNote?.title} onSettingsOpen={() => setShowSettings(true)} />
      </div>

      {/* ── Sidebar (Knowledge Mode Only) ── */}
      {activeMode !== 'agent' && (
        <div className="workspace-sidebar">
          <Sidebar
            onNewNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onSelectNote={handleSelectNote}
            loadingNotes={false}
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
              <HomeDashboard onNewNote={handleCreateNote} />
            )}

            {activeView === 'notes' && (
              <NoteWorkspace
                onStatsChange={() => {}}
              />
            )}

            {activeView === 'study' && (
              <StudyCenter />
            )}

            {activeView === 'search' && (
              <SearchPage />
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
              wordCount={activeNote?.content ? activeNote.content.split(/\s+/).filter(Boolean).length : 0}
              charCount={activeNote?.content ? activeNote.content.length : 0}
            />
          </div>
        </>
      )}

      {/* ── Command Palette ── */}
      <CommandPalette onNewNote={handleCreateNote} />

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
