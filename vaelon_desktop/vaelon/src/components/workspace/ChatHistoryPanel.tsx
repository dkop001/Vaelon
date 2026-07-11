import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useChatStore } from '../../store/chatStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { api, ChatSession, ChatMessage } from '../../ipc/client';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconBack    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChat    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 2.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5L2 12V8.5H2.5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
const IconTrash   = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M4.5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconSpinner = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="20 14" strokeLinecap="round"/></svg>;

function timeAgo(date: string | undefined): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Session Row ───────────────────────────────────────────────────────────────
function SessionRow({
  session, isActive, onSelect, onDelete
}: {
  session: ChatSession;
  isActive: boolean;
  onSelect: (s: ChatSession) => void;
  onDelete: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`chat-history-item ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(session)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(session)}
    >
      <div className="chat-history-item-icon"><IconChat /></div>
      <div className="chat-history-item-content">
        <div className="chat-history-item-title">{session.title || 'Untitled Chat'}</div>
        <div className="chat-history-item-meta">{timeAgo(session.updated_at)}</div>
      </div>
      {hover && (
        <button
          className="chat-history-item-delete"
          onClick={e => { e.stopPropagation(); onDelete(session.id); }}
          aria-label="Delete chat"
          title="Delete chat"
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}

// ── Chat View (conversation detail) ──────────────────────────────────────────
function ChatView({
  session, messages, onBack
}: {
  session: ChatSession;
  messages: ChatMessage[];
  onBack: () => void;
}) {
  return (
    <div className="chat-history-view">
      <div className="chat-history-view-header">
        <button className="chat-history-back" onClick={onBack} aria-label="Back to list">
          <IconBack />
        </button>
        <div className="chat-history-view-title">{session.title || 'Untitled Chat'}</div>
      </div>
      <div className="chat-history-view-messages">
        {messages.length === 0 ? (
          <div className="chat-history-empty">No messages saved yet.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || i} className={`chat-history-msg ${msg.role}`}>
              <div className="chat-history-msg-role">{msg.role === 'user' ? 'You' : 'AI'}</div>
              <div className="chat-history-msg-content">{msg.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main ChatHistoryPanel ─────────────────────────────────────────────────────
export default function ChatHistoryPanel() {
  const { setSidebarMode } = useAppStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const { sessions, activeSessionId, selectSession, loading } = useChatStore();

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewMessages, setViewMessages] = useState<ChatMessage[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Load messages when viewing a specific session
  useEffect(() => {
    if (!viewingId) { setViewMessages([]); return; }
    setViewLoading(true);
    api.chatMessagesList(viewingId)
      .then(setViewMessages)
      .catch(() => setViewMessages([]))
      .finally(() => setViewLoading(false));
  }, [viewingId]);

  const handleSelectSession = (session: ChatSession) => {
    selectSession(session.id);
    useAppStore.getState().openRightPanel('chat');
    setViewingId(session.id);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.chatSessionDelete(sessionId);
      // Reload sessions
      if (activeWorkspaceId) {
        useChatStore.getState().loadSessions(activeWorkspaceId);
      }
      if (viewingId === sessionId) setViewingId(null);
    } catch { /* noop */ }
  };

  // Conversation detail view
  if (viewingId) {
    const session = sessions.find(s => s.id === viewingId);
    return (
      <div className="chat-history-panel">
        <ChatView
          session={session || { id: viewingId, title: 'Chat', workspace_id: '', project_id: '', created_at: '', updated_at: '' }}
          messages={viewLoading ? [] : viewMessages}
          onBack={() => setViewingId(null)}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="chat-history-panel">
      <div className="chat-history-header">
        <button className="chat-history-back" onClick={() => setSidebarMode('nav')} aria-label="Back to navigation">
          <IconBack />
        </button>
        <div className="chat-history-header-title">
          <IconChat /> Saved Chats
        </div>
      </div>

      <div className="chat-history-list">
        {loading ? (
          <div className="chat-history-loading"><IconSpinner /></div>
        ) : sessions.length === 0 ? (
          <div className="chat-history-empty-state">
            <IconChat />
            <p>No saved chats yet.</p>
            <p className="chat-history-empty-hint">
              Open a note and start a conversation in the AI panel to save chats.
            </p>
          </div>
        ) : (
          sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              isActive={session.id === (viewingId ?? activeSessionId)}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
            />
          ))
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
