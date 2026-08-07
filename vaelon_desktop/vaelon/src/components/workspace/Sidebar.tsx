import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useDocumentStore, Document } from '../../store/noteStore';
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
const IconKnowledge = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconProjects = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 5.5h5M4.5 8h5M4.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconTasks = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M11 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconResearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconGit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="3" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 3h5M4.5 11h5M3 4.5v5M11 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconBuilds = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 11h10M5 11V5M9 11V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconTerminal = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3.5 5L6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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
const IconFile = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
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
  { id: 'home',       label: 'Home',        Icon: IconHome       },
  { id: 'projects',   label: 'Projects',    Icon: IconProjects   },
  { id: 'documents',  label: 'Knowledge',   Icon: IconKnowledge  },
  { id: 'tasks',      label: 'Tasks',       Icon: IconTasks      },
  { id: 'research',   label: 'Research',    Icon: IconResearch   },
  { id: 'git',        label: 'Git',         Icon: IconGit        },
  { id: 'builds',     label: 'Builds',      Icon: IconBuilds     },
  { id: 'terminal',   label: 'Terminal',    Icon: IconTerminal   },
  { id: 'chatHistory', label: 'Chat History', Icon: IconChat      },
  { id: 'search',     label: 'Search',      Icon: IconSearch     },
];

interface DocumentRowProps {
  document: Document;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function DocumentRow({ document, isActive, onSelect, onDelete }: DocumentRowProps) {
  const [hover, setHover] = useState(false);
  const tags = getTags(document);

  return (
    <div
      className={`sidebar-item ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(document.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(document.id)}
      id={`sidebar-document-${document.id}`}
    >
      <span className="sidebar-item-icon" style={{ opacity: document.pinned ? 1 : 0.5 }}>
        {document.pinned ? <IconPin /> : <IconFile />}
      </span>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-sm)' }}>
          {document.title?.trim() || 'Untitled'}
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
          onClick={(e) => { e.stopPropagation(); onDelete(document.id); }}
          aria-label="Delete document"
          title="Delete document"
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}

interface TagPillProps {
  tag: string;
  active: boolean;
  onClick: (tag: string) => void;
}

function TagPill({ tag, active, onClick }: TagPillProps) {
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

function getTags(document: Document): string[] {
  if (!document || !document.tags) return [];
  if (Array.isArray(document.tags)) return document.tags;
  try { return JSON.parse(document.tags as unknown as string); } catch { return []; }
}

interface SidebarProps {
  onNewDocument: () => void;
  onDeleteDocument: (id: string) => void;
  onSelectDocument: (id: string) => void;
  loadingDocuments: boolean;
}

export default function Sidebar({ onNewDocument, onDeleteDocument, onSelectDocument, loadingDocuments }: SidebarProps) {
  const { activeView, setActiveView, sidebarMode, setSidebarMode } = useAppStore();
  const { activeDocumentId, searchText, setSearchText, filterTag, setFilterTag, getAllTags, getFilteredDocuments } = useDocumentStore();

  const handleNavClick = (id: string) => {
    if (id === 'chatHistory') {
      setSidebarMode('chatHistory');
    } else {
      setSidebarMode('nav');
      setActiveView(id as 'home' | 'documents' | 'projects' | 'tasks' | 'research' | 'git' | 'builds' | 'terminal' | 'search' | 'settings');
    }
  };

  const filteredDocuments = getFilteredDocuments();
  const allTags = getAllTags();

  if (sidebarMode === 'chatHistory') {
    return (
      <aside
        className="sidebar workspace-sidebar"
        aria-label="Chat history"
        id="workspace-sidebar"
      >
        <ChatHistoryPanel />
      </aside>
    );
  }

  return (
    <aside
      className="sidebar workspace-sidebar"
      aria-label="Left sidebar"
      id="workspace-sidebar"
    >
      <nav className="sidebar-section" aria-label="Main navigation">
        {NAV.map(({ id, label, Icon }) => {
          const isActive = activeView === id || (id === 'chatHistory' && (sidebarMode as 'nav' | 'chatHistory') === 'chatHistory');
          return (
            <button
              key={id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(id)}
              id={`sidebar-nav-${id}`}
            >
              <span className="sidebar-item-icon"><Icon /></span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-divider" />

      <button
        className="sidebar-new-document-btn"
        onClick={onNewDocument}
        id="sidebar-new-document"
        aria-label="Create new document"
      >
        <IconPlus /> New Document
      </button>

      {/* Search filter */}
      <div className="sidebar-search-bar">
        <IconSearch />
        <input
          type="text"
          className="sidebar-search-input"
          placeholder="Filter documents..."
          value={searchText || ''}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Filter documents by title or content"
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
          {searchText ? `${filteredDocuments.length} document${filteredDocuments.length !== 1 ? 's' : ''}` : 'All Documents'}
        </div>
      </div>

      <div className="sidebar-file-tree" role="list" aria-label="Document list">
        {loadingDocuments ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '24px', color: 'var(--tx-tertiary)' }}>
            <span>Loading...</span>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-disabled)', padding: '8px 16px', lineHeight: 1.5 }}>
            {searchText ? 'No documents match your search.' : 'No documents yet. Create one above!'}
          </p>
        ) : (
          filteredDocuments.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              isActive={document.id === activeDocumentId}
              onSelect={onSelectDocument}
              onDelete={onDeleteDocument}
            />
          ))
        )}
      </div>

      <footer className="sidebar-footer">
        <div className="sidebar-version-tag">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/></svg>
          Vaelon — Alpha
        </div>
      </footer>
    </aside>
  );
}