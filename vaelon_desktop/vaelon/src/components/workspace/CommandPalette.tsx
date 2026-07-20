import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { useDocumentStore } from '../../store/noteStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAgentStore } from '../../store/agentStore';
import { Document, DocumentType } from '../../store/noteStore';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
    <path d="m10.5 10.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconDocument = () => (
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
const IconProjects = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 5.5h5M4.5 8h5M4.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconTasks = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M11 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconResearch = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconGit = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="3" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 3h5M4.5 11h5M3 4.5v5M11 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconBuilds = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2 11h10M5 11V5M9 11V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconTerminal = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3.5 5L6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconAgent = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2"/>
  </svg>
);
const IconCode = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M4 2.5l5 5-5 5M10 2.5l-5 5 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconMemory = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2 5h10M2 9h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 3v1M9 3v1M5 11v1M9 11v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconNewDoc = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v6M4 7l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 11h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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
  documents: Document[];
  setActiveView: (view: 'home' | 'documents' | 'projects' | 'tasks' | 'research' | 'git' | 'builds' | 'terminal' | 'search' | 'settings') => void;
  selectDocument: (id: string) => void;
  onNewDocument: (type?: DocumentType) => void;
  openRightPanel: (tab?: 'chat' | 'summary') => void;
  toggleTheme: () => void;
  setActiveMode: (mode: 'knowledge' | 'agent') => void;
  startAgent: (goal: string, workspacePath: string) => Promise<void>;
}

function buildCommands({
  documents,
  setActiveView,
  selectDocument,
  onNewDocument,
  openRightPanel,
  toggleTheme,
  setActiveMode,
  startAgent,
}: BuildCommandsProps): Command[] {
  const docCommands: Command[] = documents.map((d) => ({
    id: `doc-${d.id}`,
    label: d.title?.trim() || 'Untitled',
    sub: `${d.type?.charAt(0).toUpperCase() + d.type?.slice(1) || 'Knowledge'} • ${d.project_id?.slice(0, 8)}`,
    Icon: IconDocument,
    group: 'Documents',
    action: () => { selectDocument(d.id); setActiveView('documents'); },
  }));

  const createDocCommands: Command[] = [
    {
      id: 'new-knowledge',
      label: 'New Knowledge Document',
      sub: 'Create a general knowledge entry',
      Icon: IconNewDoc,
      group: 'Create',
      kbd: ['⌘', 'N'],
      action: () => { onNewDocument('knowledge'); setActiveView('documents'); },
    },
    {
      id: 'new-research',
      label: 'New Research Document',
      sub: 'Save research findings, comparisons, references',
      Icon: IconResearch,
      group: 'Create',
      action: () => { onNewDocument('research'); setActiveView('documents'); },
    },
    {
      id: 'new-code',
      label: 'New Code Document',
      sub: 'Code snippets, patterns, algorithms',
      Icon: IconCode,
      group: 'Create',
      action: () => { onNewDocument('code'); setActiveView('documents'); },
    },
    {
      id: 'new-task',
      label: 'New Task Document',
      sub: 'Track tasks, todos, action items',
      Icon: IconTasks,
      group: 'Create',
      action: () => { onNewDocument('task'); setActiveView('documents'); },
    },
    {
      id: 'new-memory',
      label: 'New Agent Memory',
      sub: 'Store context for the AI agent',
      Icon: IconMemory,
      group: 'Create',
      action: () => { onNewDocument('memory'); setActiveView('documents'); },
    },
  ];

  return [
    ...docCommands,
    ...createDocCommands,
    { id: 'go-home', label: 'Home', sub: 'Dashboard overview', Icon: IconHome, group: 'Navigate', action: () => setActiveView('home') },
    { id: 'go-documents', label: 'Knowledge', sub: 'Browse documents', Icon: IconDocument, group: 'Navigate', action: () => setActiveView('documents') },
    { id: 'go-projects', label: 'Projects', sub: 'Manage projects', Icon: IconProjects, group: 'Navigate', action: () => setActiveView('projects') },
    { id: 'go-tasks', label: 'Tasks', sub: 'Project tasks & todos', Icon: IconTasks, group: 'Navigate', action: () => setActiveView('tasks') },
    { id: 'go-research', label: 'Research', sub: 'Search, save, compare sources', Icon: IconResearch, group: 'Navigate', action: () => setActiveView('research') },
    { id: 'go-git', label: 'Git', sub: 'Commits, branches, MRs, diff', Icon: IconGit, group: 'Navigate', action: () => setActiveView('git') },
    { id: 'go-builds', label: 'Builds', sub: 'Build logs, artifacts, deploys', Icon: IconBuilds, group: 'Navigate', action: () => setActiveView('builds') },
    { id: 'go-terminal', label: 'Terminal', sub: 'Integrated shell', Icon: IconTerminal, group: 'Navigate', kbd: ['⌘', '`'], action: () => setActiveView('terminal') },
    { id: 'go-search', label: 'Search', sub: 'Global search across everything', Icon: IconSearch, group: 'Navigate', kbd: ['⌘', 'K'], action: () => setActiveView('search') },
    { id: 'go-settings', label: 'Settings', sub: 'Account & preferences', Icon: IconSettings, group: 'Navigate', action: () => setActiveView('settings') },

    { id: 'ai-chat', label: 'Chat with AI', sub: 'Ask about your project', Icon: IconChat, group: 'AI', action: () => openRightPanel('chat') },
    { id: 'ai-summarize', label: 'Summarize Document', sub: 'AI summary of active document', Icon: IconAI, group: 'AI', action: () => openRightPanel('summary') },
    { id: 'ai-agent', label: 'Run Agent', sub: 'Start autonomous coding agent', Icon: IconAgent, group: 'AI', kbd: ['⌘', '⇧', 'A'], action: () => { setActiveMode('agent'); const ws = useWorkspaceStore.getState(); startAgent('', ws.activeWorkspaceId ?? '.'); } },
    { id: 'toggle-theme', label: 'Toggle Dark / Light', sub: 'Switch color theme', Icon: IconTheme, group: 'Appearance', kbd: ['⌘', '⇧', 'L'], action: toggleTheme },
    { id: 'mode-knowledge', label: 'Knowledge Mode', sub: 'Documents, research, planning', Icon: IconDocument, group: 'Mode', action: () => setActiveMode('knowledge') },
    { id: 'mode-agent', label: 'Agent Mode', sub: 'Autonomous coding agent', Icon: IconAgent, group: 'Mode', action: () => setActiveMode('agent') },
  ];
}

interface CommandPaletteProps {
  onNewDocument: (type?: DocumentType) => void;
}

export default function CommandPalette({ onNewDocument }: CommandPaletteProps) {
  const { cmdOpen, closeCmd, setActiveView, openRightPanel, toggleTheme, setActiveMode } = useAppStore();
  const { documents, selectDocument } = useDocumentStore();
  const { startAgent } = useAgentStore();

  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const commands = buildCommands({ documents, setActiveView, selectDocument, onNewDocument, openRightPanel, toggleTheme, setActiveMode, startAgent });

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

  const flat = filtered;

  const runSelected = useCallback(() => {
    const cmd = flat[selectedIdx];
    if (cmd) { cmd.action(); closeCmd(); }
  }, [flat, selectedIdx, closeCmd]);

  useEffect(() => {
    if (cmdOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [cmdOpen]);

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
        {/* Search row */}
        <div className="cmd-search-row">
          <span className="cmd-search-icon"><IconSearch /></span>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Search documents or run a command…"
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

        {/* Results */}
        <div className="cmd-results" ref={listRef} role="listbox">
          {flat.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--tx-disabled)' }}>
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

        {/* Footer */}
        <div className="cmd-footer">
          <div className="cmd-footer-nav">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>esc</kbd> close</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
            Vaelon
          </span>
        </div>
      </div>
    </div>
  );
}