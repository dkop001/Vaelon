import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import { getUserSessions, deleteSession } from '../../lib/chatApi';

// ── Icons ──
const IconBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChat = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 2.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5L2 12V8.5H2.5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M2 3.5h9M4.5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="20 14" strokeLinecap="round"/>
  </svg>
);
const IconFile = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);

// ── Session Row ──
function SessionRow({ session, isActive, onSelect, onDelete, preview }) {
  const [hover, setHover] = useState(false);

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      className={`chat-history-item ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(session)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(session)}
    >
      <div className="chat-history-item-icon">
        <IconChat />
      </div>
      <div className="chat-history-item-content">
        <div className="chat-history-item-title">
          {session.noteTitle || session.title || 'Untitled Chat'}
        </div>
        <div className="chat-history-item-meta">
          {timeAgo(session.updatedAt || session.updated_at)}
        </div>
      </div>
      {hover && (
        <button
          className="chat-history-item-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
          aria-label="Delete chat"
          title="Delete chat"
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}

// ── Viewing Mode (conversation detail) ──
function ChatView({ session, messages, onBack }) {
  return (
    <div className="chat-history-view">
      <div className="chat-history-view-header">
        <button className="chat-history-back" onClick={onBack} aria-label="Back to list">
          <IconBack />
        </button>
        <div className="chat-history-view-title">
          {session.title || 'Untitled Chat'}
        </div>
      </div>
      <div className="chat-history-view-messages">
        {messages.length === 0 ? (
          <div className="chat-history-empty">
            No messages saved yet.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={`chat-history-msg ${msg.role}`}>
              <div className="chat-history-msg-role">
                {msg.role === 'user' ? 'You' : 'AI'}
              </div>
              <div className="chat-history-msg-content">
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main ChatHistoryPanel ──
export default function ChatHistoryPanel() {
  const { setActiveView, setSidebarMode, viewingSessionId, setViewingSessionId } = useAppStore();
  const { notes } = useNoteStore();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMessages, setViewMessages] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Load user's saved sessions
  useEffect(() => {
    setLoading(true);
    getUserSessions('local')
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  // Load messages when viewing a session
  useEffect(() => {
    if (!viewingSessionId) {
      setViewMessages([]);
      return;
    }
    const session = sessions.find(s => s.id === viewingSessionId);
    if (session?.messages) {
      setViewMessages(session.messages);
    } else {
      setViewMessages([]);
    }
  }, [viewingSessionId, sessions]);

  const handleSelectSession = (session) => {
    const noteId = session.noteId || session.note_id;
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      useNoteStore.getState().setActiveNote(note.id);
      useAppStore.getState().setActiveView('notes');
      useAppStore.getState().openRightPanel('chat');
    }
    setViewingSessionId(session.id);
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      const noteId = session?.noteId || session?.note_id;
      if (noteId) {
        await deleteSession('local', noteId);
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (viewingSessionId === sessionId) setViewingSessionId(null);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    setViewingSessionId(null);
  };

  // Viewing a specific conversation
  if (viewingSessionId) {
    const session = sessions.find((s) => s.id === viewingSessionId);
    return (
      <div className="chat-history-panel">
        <ChatView
          session={session || { title: 'Chat' }}
          messages={viewMessages}
          onBack={handleBack}
          loading={viewLoading}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="chat-history-panel">
      {/* Header with back button */}
      <div className="chat-history-header">
        <button className="chat-history-back" onClick={() => setSidebarMode('nav')} aria-label="Back to navigation">
          <IconBack />
        </button>
        <div className="chat-history-header-title">
          <IconChat />
          Saved Chats
        </div>
      </div>

      {/* Session list */}
      <div className="chat-history-list">
        {loading ? (
          <div className="chat-history-loading">
            <IconSpinner />
          </div>
        ) : sessions.length === 0 ? (
          <div className="chat-history-empty-state">
            <IconChat />
            <p>No saved chats yet.</p>
            <p className="chat-history-empty-hint">
              Open a note and click <strong>Save</strong> in the AI panel to save a conversation.
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              isActive={session.id === viewingSessionId}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
            />
          ))
        )}
      </div>
    </div>
  );
}
