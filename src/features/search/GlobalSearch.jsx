import { useState, useEffect, useRef, useCallback } from 'react';
import { useNoteStore } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="m10 10 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconNote = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 5h6M4 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconHome = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 7 7 1.5 12.5 7V12.5H9V9H5v3.5H1.5V7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconStudy = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconReturn = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M10 3v3H2.5M2.5 6 5 3.5M2.5 6 5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Static commands ───────────────────────────────────────────────────────────
const STATIC_COMMANDS = [
  { id: 'go-home',  label: 'Go to Home',         icon: 'home',  view: 'home',    group: 'Navigation' },
  { id: 'go-notes', label: 'Go to Notes',         icon: 'note',  view: 'notes',   group: 'Navigation' },
  { id: 'go-study', label: 'Go to Study Center',  icon: 'study', view: 'study',   group: 'Navigation' },
  { id: 'new-note', label: 'Create New Note',     icon: 'plus',  action: 'new-note', group: 'Actions' },
];

function IconFor({ type }) {
  if (type === 'home')  return <IconHome />;
  if (type === 'study') return <IconStudy />;
  if (type === 'plus')  return <IconPlus />;
  return <IconNote />;
}

// ── Highlight matched text ────────────────────────────────────────────────────
function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={{ background: 'hsla(262,80%,60%,0.25)', color: 'var(--accent-primary)', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ── Main GlobalSearch component ───────────────────────────────────────────────
export default function GlobalSearch({ onNewNote }) {
  const { cmdOpen, closeCmd, setActiveView } = useAppStore();
  const { notes, setActiveNote } = useNoteStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Build result list
  const results = (() => {
    const q = query.trim().toLowerCase();
    const cmds = STATIC_COMMANDS.filter(
      c => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    ).map(c => ({ ...c, type: 'command' }));

    const noteResults = notes
      .filter(n => {
        if (!q) return true;
        const title = (n.title || '').toLowerCase();
        const content = (n.content || '').replace(/<[^>]*>/g, '').toLowerCase();
        return title.includes(q) || content.includes(q);
      })
      .slice(0, 5)
      .map(n => ({ id: n.id, label: n.title || 'Untitled', type: 'note', group: 'Notes', noteId: n.id }));

    return [...cmds, ...noteResults];
  })();

  // Reset index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (cmdOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [cmdOpen]);

  // Keyboard: close on Escape, global ⌘K / Ctrl+K opener
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (cmdOpen) closeCmd();
        else useAppStore.getState().openCmd();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen, closeCmd]);

  const activate = useCallback((item) => {
    if (!item) return;
    closeCmd();
    if (item.type === 'note') {
      setActiveNote(item.noteId);
      setActiveView('notes');
    } else if (item.action === 'new-note') {
      onNewNote?.();
      setActiveView('notes');
    } else if (item.view) {
      setActiveView(item.view);
    }
  }, [closeCmd, setActiveNote, setActiveView, onNewNote]);

  const handleKey = (e) => {
    if (e.key === 'Escape') { closeCmd(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); activate(results[activeIdx]); }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!cmdOpen) return null;

  // Group items for rendering
  const groups = {};
  results.forEach((r, i) => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push({ ...r, _idx: i });
  });

  return (
    <div
      className="cmd-backdrop"
      onClick={closeCmd}
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
    >
      <div className="cmd-modal" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="cmd-input-row">
          <span className="cmd-input-icon"><IconSearch /></span>
          <input
            ref={inputRef}
            id="cmd-search-input"
            className="cmd-input"
            type="text"
            placeholder="Search notes or jump to..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-esc-badge">esc</kbd>
        </div>

        {/* Results */}
        <div className="cmd-list" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="cmd-empty">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="cmd-group">
                <div className="cmd-group-label">{group}</div>
                {items.map(item => (
                  <button
                    key={item.id}
                    data-idx={item._idx}
                    className={`cmd-item${item._idx === activeIdx ? ' cmd-item-active' : ''}`}
                    role="option"
                    aria-selected={item._idx === activeIdx}
                    onMouseEnter={() => setActiveIdx(item._idx)}
                    onClick={() => activate(item)}
                    type="button"
                  >
                    <span className="cmd-item-icon">
                      <IconFor type={item.type === 'note' ? 'note' : item.icon} />
                    </span>
                    <span className="cmd-item-label">
                      <Highlight text={item.label} query={query} />
                    </span>
                    {item._idx === activeIdx && (
                      <span className="cmd-item-return"><IconReturn /></span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="cmd-footer">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
