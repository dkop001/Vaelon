import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import ChatHistoryPanel from './ChatHistoryPanel';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconHome = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 6.5 7 1.5l5.5 5V12a1 1 0 0 1-1 1H9v-3.5H5V13H2.5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IconNotes = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconStudy = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconFile = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
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

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV = [
  { id: 'home',     label: 'Home',        Icon: IconHome   },
  { id: 'notes',    label: 'Notes',       Icon: IconNotes  },
  { id: 'study',    label: 'Study',       Icon: IconStudy  },
  { id: 'chatHistory', label: 'Chat History', Icon: IconChat },
  { id: 'search',   label: 'Search',      Icon: IconSearch },
];

// ── Note file row ─────────────────────────────────────────────────────────────
function NoteRow({ note, isActive, onSelect, onDelete }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(note.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(note.id)}
      id={`sidebar-note-${note.id}`}
    >
      <span className="sidebar-item-icon"><IconFile /></span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>
        {note.title?.trim() || 'Untitled'}
      </span>
      {hover && (
        <button
          className="btn btn-icon-sm btn-ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          aria-label="Delete note"
          title="Delete note"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar({ onNewNote, onDeleteNote, onSelectNote, loadingNotes }) {
  const { activeView, setActiveView, mobileSidebarOpen, sidebarMode, openChatHistory, closeChatHistory } = useAppStore();
  const { notes, activeNoteId } = useNoteStore();

  const handleNavClick = (id) => {
    if (id === 'chatHistory') {
      openChatHistory();
    } else {
      closeChatHistory();
      setActiveView(id);
    }
  };

  // If in chat history mode, show ChatHistoryPanel
  if (sidebarMode === 'chatHistory') {
    return (
      <aside
        className={`sidebar workspace-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}
        aria-label="Chat history"
        id="workspace-sidebar"
      >
        <ChatHistoryPanel />
      </aside>
    );
  }

  // Normal navigation mode
  return (
    <aside
      className={`sidebar workspace-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}
      aria-label="Left sidebar"
      id="workspace-sidebar"
    >
      {/* Nav */}
      <nav className="sidebar-section" aria-label="Main navigation">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-item ${(activeView === id || (id === 'chatHistory' && sidebarMode === 'chatHistory')) ? 'active' : ''}`}
            onClick={() => handleNavClick(id)}
            id={`sidebar-nav-${id}`}
          >
            <span className="sidebar-item-icon"><Icon /></span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      {/* New note CTA */}
      <button
        className="sidebar-new-note-btn"
        onClick={onNewNote}
        id="sidebar-new-note"
        aria-label="Create new note"
      >
        <IconPlus /> New note
      </button>

      {/* Recent notes label */}
      <div style={{ padding: '0 var(--sp-4)' }}>
        <div className="sidebar-label">Recent</div>
      </div>

      {/* File tree */}
      <div className="sidebar-file-tree" role="list" aria-label="Note list">
        {loadingNotes ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '24px', color: 'var(--tx-tertiary)' }}>
            <IconSpinner />
          </div>
        ) : notes.length === 0 ? (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-disabled)', padding: '8px 16px', lineHeight: 1.5 }}>
            No notes yet. Create one above!
          </p>
        ) : (
          notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onSelect={onSelectNote}
              onDelete={onDeleteNote}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="sidebar-footer">
        <div className="sidebar-version-tag">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/></svg>
          Note AI — Beta
        </div>
      </footer>
    </aside>
  );
}
