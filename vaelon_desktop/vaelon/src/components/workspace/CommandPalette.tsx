import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import { Note } from '../../ipc/client';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
    <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconNote = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="2" y="1.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 4.5h5M4 7h5M4 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconStudy = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconHome = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 6.5 7 1.5l5.5 5V12a1 1 0 0 1-1 1H9v-3.5H5V13H2.5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconTheme = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M12.5 9A5.5 5.5 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChat = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 2.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5L2 12V8.5H2.5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconSettings = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M7 1v1M7 12v1M1 7H2M12 7h1M2.34 2.34l.7.7M10.96 10.96l.7.7M11.66 2.34l-.7.7M3.04 10.96l-.7.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

interface Command {
  id: string;
  label: string;
  sub?: string;
  Icon: React.ComponentType;
  group: string;
  kbd?: string[];
  action: () => void;
}

interface BuildCommandsProps {
  notes: Note[];
  setActiveView: (view: 'home' | 'notes' | 'study' | 'search' | 'settings') => void;
  setActiveNote: (id: string | null) => void;
  onNewNote: () => void;
  openRightPanel: (tab?: 'chat' | 'summary' | 'quiz') => void;
  toggleTheme: () => void;
}

// ── Commands registry ─────────────────────────────────────────────────────────
function buildCommands({ notes, setActiveView, setActiveNote, onNewNote, openRightPanel, toggleTheme }: BuildCommandsProps): Command[] {
  const noteCommands: Command[] = notes.map((n) => ({
    id: `note-${n.id}`,
    label: n.title?.trim() || 'Untitled',
    sub: 'Open note',
    Icon: IconNote,
    group: 'Notes',
    action: () => { setActiveNote(n.id); setActiveView('notes'); },
  }));

  return [
    ...noteCommands,
    {
      id: 'new-note',
      label: 'New Note',
      sub: 'Create a blank note',
      Icon: IconPlus,
      group: 'Actions',
      kbd: ['⌘', 'N'],
      action: () => { onNewNote(); },
    },
    {
      id: 'go-home',
      label: 'Go to Home',
      sub: 'Dashboard overview',
      Icon: IconHome,
      group: 'Navigate',
      action: () => setActiveView('home'),
    },
    {
      id: 'go-notes',
      label: 'Go to Notes',
      sub: 'Note workspace',
      Icon: IconNote,
      group: 'Navigate',
      action: () => setActiveView('notes'),
    },
    {
      id: 'go-study',
      label: 'Study Center',
      sub: 'Flashcards & quizzes',
      Icon: IconStudy,
      group: 'Navigate',
      action: () => setActiveView('study'),
    },
    {
      id: 'go-settings',
      label: 'Settings',
      sub: 'Account & preferences',
      Icon: IconSettings,
      group: 'Navigate',
      action: () => setActiveView('settings'),
    },
    {
      id: 'ai-chat',
      label: 'Chat with AI',
      sub: 'Ask anything about your notes',
      Icon: IconChat,
      group: 'AI',
      action: () => openRightPanel('chat'),
    },
    {
      id: 'ai-summarize',
      label: 'Summarize Note',
      sub: 'AI-powered summary of active note',
      Icon: IconAI,
      group: 'AI',
      action: () => openRightPanel('summary'),
    },
    {
      id: 'ai-quiz',
      label: 'Generate Quiz',
      sub: 'Create a quiz from active note',
      Icon: IconStudy,
      group: 'AI',
      action: () => openRightPanel('quiz'),
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Dark / Light Mode',
      sub: 'Switch color theme',
      Icon: IconTheme,
      group: 'Appearance',
      kbd: ['⌘', '⇧', 'L'],
      action: toggleTheme,
    },
  ];
}

interface CommandPaletteProps {
  onNewNote: () => void;
}

// ── CommandPalette ─────────────────────────────────────────────────────────────
export default function CommandPalette({ onNewNote }: CommandPaletteProps) {
  const { cmdOpen, closeCmd, setActiveView, openRightPanel, toggleTheme } = useAppStore();
  const { notes, setActiveNote } = useNoteStore();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const commands = buildCommands({ notes, setActiveView, setActiveNote, onNewNote, openRightPanel, toggleTheme });

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.sub ?? '').toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Flat indexed list for keyboard navigation
  const flat = filtered;

  const runSelected = useCallback(() => {
    const cmd = flat[selectedIdx];
    if (cmd) { cmd.action(); closeCmd(); }
  }, [flat, selectedIdx, closeCmd]);

  // Focus input when palette opens
  useEffect(() => {
    if (cmdOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [cmdOpen]);

  // Keyboard global listener for Cmd+K to open
  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!cmdOpen) useAppStore.getState().openCmd();
      }
    };
    window.addEventListener('keydown', handleGlobal);
    return () => window.removeEventListener('keydown', handleGlobal);
  }, [cmdOpen]);

  // Arrow key / Enter / Escape navigation
  useEffect(() => {
    if (!cmdOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCmd();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [cmdOpen, flat, runSelected, closeCmd]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  if (!cmdOpen) return null;

  let flatIdx = 0;

  return (
    <div
      className="cmd-overlay"
      onClick={closeCmd}
      id="cmd-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="cmd-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* ── Search row ── */}
        <div className="cmd-search-row">
          <span className="cmd-search-icon"><IconSearch /></span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search notes or run a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command search"
            id="cmd-input"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <span className="cmd-shortcut-hint">{flat.length} result{flat.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* ── Results ── */}
        <div className="cmd-results" ref={listRef} role="listbox">
          {flat.length === 0 ? (
            <div style={{
              padding: '32px 16px', textAlign: 'center',
              fontSize: 'var(--text-sm)', color: 'var(--tx-disabled)',
            }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="cmd-section-label">{group}</div>
                {items.map((cmd) => {
                  const idx = flatIdx++;
                  const isActive = idx === selectedIdx;
                  return (
                    <div
                      key={cmd.id}
                      className={`cmd-item ${isActive ? 'active' : ''}`}
                      onClick={() => { cmd.action(); closeCmd(); }}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      role="option"
                      aria-selected={isActive}
                      id={`cmd-item-${cmd.id}`}
                      ref={isActive ? selectedRef : null}
                    >
                      <div className="cmd-item-icon">
                        <cmd.Icon />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cmd-item-label">{cmd.label}</div>
                        {cmd.sub && <div className="cmd-item-desc">{cmd.sub}</div>}
                      </div>
                      {cmd.kbd && (
                        <div className="cmd-item-kbd" style={{ display: 'flex', gap: 2 }}>
                          {cmd.kbd.map((k, i) => (
                            <kbd key={i} style={{
                              padding: '1px 5px', borderRadius: 3,
                              border: '1px solid var(--border)',
                              background: 'var(--bg-overlay)',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9px',
                            }}>{k}</kbd>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="cmd-footer">
          <div className="cmd-footer-nav">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>esc</kbd> close</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
            Note AI
          </span>
        </div>
      </div>
    </div>
  );
}
