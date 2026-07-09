import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import ChatHistoryPanel from './ChatHistoryPanel';

// ── Inline SVGs ───────────────────────────────────────────────────────────
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
const IconPin = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <path d="M7.5 1 11 4.5l-2 1-1 4-2.5 1.5L3 8.5 1.5 6 3 3.5l4-1 1-2L7.5 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
  </svg>
);
const IconX = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M1 1l8 8M9 1 1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const NAV = [
  { id: 'home',     label: 'Home',        Icon: IconHome   },
  { id: 'notes',    label: 'Notes',       Icon: IconNotes  },
  { id: 'study',    label: 'Study',       Icon: IconStudy  },
  { id: 'chatHistory', label: 'Chat History', Icon: IconChat },
  { id: 'search',   label: 'Search',      Icon: IconSearch },
];

function NoteRow({ note, isActive, onSelect, onDelete }) {
  const [hover, setHover] = useState(false);
  const tags = getTags(note);

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
      <span className="sidebar-item-icon" style={{ opacity: note.pinned ? 1 : 0.5 }}>
        {note.pinned ? <IconPin /> : <IconFile />}
      </span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>
          {note.title?.trim() || 'Untitled'}
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap' }}>
            {tags.slice(0, 2).map(t => (
              <span key={t} className="sidebar-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
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

function TagPill({ tag, active, onClick }) {
  return (
    <button
      className={`sidebar-tag-pill ${active ? 'active' : ''}`}
      onClick={() => onClick(tag)}
    >
      {tag}
      {active && <IconX />}
    </button>
  );
}

function getTags(note) {
  if (!note || !note.tags) return [];
  if (Array.isArray(note.tags)) return note.tags;
  try { return JSON.parse(note.tags); } catch { return []; }
}

export default function Sidebar({ onNewNote, onDeleteNote, onSelectNote, loadingNotes }) {
  const { activeView, setActiveView, mobileSidebarOpen, sidebarMode, openChatHistory, closeChatHistory } = useAppStore();
  const { notes, activeNoteId, searchText, setSearchText, filterTag, setFilterTag, getAllTags, getFilteredNotes } = useNoteStore();

  const handleNavClick = (id) => {
    if (id === 'chatHistory') {
      openChatHistory();
    } else {
      closeChatHistory();
      setActiveView(id);
    }
  };

  const filteredNotes = getFilteredNotes();
  const allTags = getAllTags();

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

  return (
    <aside
      className={`sidebar workspace-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}
      aria-label="Left sidebar"
      id="workspace-sidebar"
    >
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

      <button
        className="sidebar-new-note-btn"
        onClick={onNewNote}
        id="sidebar-new-note"
        aria-label="Create new note"
      >
        <IconPlus /> New note
      </button>

      {/* Search filter */}
      <div className="sidebar-search-bar">
        <IconSearch />
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Filter notes..."
          value={searchText || ''}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Filter notes by title or content"
        />
        {searchText && (
          <button className="btn btn-icon-sm btn-ghost" onClick={() => setSearchText('')} style={{ flexShrink: 0 }}>
            <IconX />
          </button>
        )}
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="sidebar-tag-list">
          {allTags.map(tag => (
            <TagPill
              key={tag}
              tag={tag}
              active={filterTag === tag}
              onClick={(t) => setFilterTag(filterTag === t ? null : t)}
            />
          ))}
        </div>
      )}

      <div className="sidebar-divider" />

      <div style={{ padding: '0 var(--sp-4)' }}>
        <div className="sidebar-label">
          {searchText ? `${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''}` : 'All Notes'}
        </div>
      </div>

      <div className="sidebar-file-tree" role="list" aria-label="Note list">
        {loadingNotes ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '24px', color: 'var(--tx-tertiary)' }}>
            <span>Loading...</span>
          </div>
        ) : filteredNotes.length === 0 ? (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-disabled)', padding: '8px 16px', lineHeight: 1.5 }}>
            {searchText ? 'No notes match your search.' : 'No notes yet. Create one above!'}
          </p>
        ) : (
          filteredNotes.map((note) => (
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

      <footer className="sidebar-footer">
        <div className="sidebar-version-tag">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/></svg>
          Flow — Beta
        </div>
      </footer>
    </aside>
  );
}