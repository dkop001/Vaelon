import { useState, useEffect } from 'react';
import { useAppStore, ActiveView } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDocumentStore, Document } from '../../store/noteStore';
import { api } from '../../ipc/client';
import ChatHistoryPanel from './ChatHistoryPanel';
import VaelonLogo from '../VaelonLogo';

// ── Inline SVGs ───────────────────────────────────────────────────────────
const IconHome = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 6.5 7 1.5l5.5 5V12a1 1 0 0 1-1 1H9v-3.5H5V13H2.5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IconProjects = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 5.5h5M4.5 8h5M4.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconKnowledge = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconTasks = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M11 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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
const IconGraph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="3" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.2 4.2 9.8 9.8M9.8 4.2 4.2 9.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconFolder = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M1.5 3.5a1 1 0 0 1 1-1h2.5l1.5 1.5h4a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconMemory = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7 4.5V7l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7 1v1M7 12v1M1 7H2M12 7h1M2.34 2.34l.7.7M10.96 10.96l.7.7M11.66 2.34l-.7.7M3.04 10.96l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconFile = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
interface NavItem { id: ActiveView | 'chatHistory'; label: string; Icon: React.FC };
interface NavGroup { group: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Workspace',
    items: [
      { id: 'home',       label: 'Mission Control', Icon: IconHome      },
      { id: 'projects',   label: 'Project',         Icon: IconProjects  },
      { id: 'documents',  label: 'Files',           Icon: IconKnowledge },
      { id: 'search',     label: 'Search',          Icon: IconSearch    },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'memory',     label: 'Memory',          Icon: IconMemory    },
      { id: 'graph',      label: 'Graph',           Icon: IconGraph     },
      { id: 'agent',      label: 'Agent',           Icon: IconAI        },
    ],
  },
  {
    group: 'Development',
    items: [
      { id: 'terminal',   label: 'Terminal',        Icon: IconTerminal  },
      { id: 'git',        label: 'Git',             Icon: IconGit       },
      { id: 'timeline',   label: 'Timeline',        Icon: IconClock     },
      { id: 'tasks',      label: 'Tasks',           Icon: IconTasks     },
      { id: 'chatHistory', label: 'Chat History',   Icon: IconChat      },
    ],
  },
  {
    group: 'System',
    items: [
      { id: 'settings',   label: 'Settings',        Icon: IconSettings  },
    ],
  },
];

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  gitStatus?: string;
  children?: FileNode[];
}

function GitBadge({ status }: { status?: string }) {
  if (!status) return null;
  return <span className={`file-git-status ${status}`}>{status}</span>;
}

function FileRow({ node, depth, onOpen }: { node: FileNode; depth: number; onOpen: (path: string) => void }) {
  const [open, setOpen] = useState(depth < 1 && node.is_dir);
  if (node.is_dir) {
    return (
      <>
        <div
          className="sidebar-item"
          style={{ paddingLeft: `calc(var(--sp-3) + ${depth * 14}px)` }}
          onClick={() => setOpen((o) => !o)}
          role="button"
        >
          <span className="sidebar-item-icon" style={{ opacity: 0.7 }}><IconFolder /></span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
          <span style={{ fontSize: 9, color: 'var(--tx-disabled)' }}>{open ? '▾' : '▸'}</span>
        </div>
        {open && node.children?.map((child) => (
          <FileRow key={child.path} node={child} depth={depth + 1} onOpen={onOpen} />
        ))}
      </>
    );
  }
  return (
    <div
      className="sidebar-item"
      style={{ paddingLeft: `calc(var(--sp-3) + ${depth * 14}px)` }}
      onClick={() => onOpen(node.path)}
      role="button"
    >
      <span className="sidebar-item-icon" style={{ opacity: 0.6 }}><IconFile /></span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      <GitBadge status={node.gitStatus} />
    </div>
  );
}

interface SidebarProps {
  onNewDocument: () => void;
}

export default function Sidebar({ onNewDocument }: SidebarProps) {
  const { activeView, setActiveView, sidebarMode, setSidebarMode, backgroundServices, setActiveProjectPath } = useAppStore();
  const { workspaces, activeWorkspaceId, selectWorkspace, projects, activeProjectId, selectProject, getActiveProject } = useWorkspaceStore();
  const { documents, activeDocumentId, selectDocument } = useDocumentStore();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeProject = getActiveProject();

  // Load file tree for the active workspace
  useEffect(() => {
    if (!activeWs) {
      setFileTree([]);
      return;
    }
    setActiveProjectPath(activeWs.path);
    setTreeLoading(true);
    api
      .fsList(activeWs.path)
      .then((entries) => {
        const build = (entries: { name: string; path: string; is_dir: boolean }[]): FileNode[] =>
          entries
            .filter((e) => !['node_modules', '.git', 'dist', '.next', 'target'].includes(e.name))
            .sort((a, b) => Number(b.is_dir) - Number(a.is_dir))
            .map((e) => ({ name: e.name, path: e.path, is_dir: e.is_dir, children: [] }));
        setFileTree(build(entries));
      })
      .catch(() => setFileTree([]))
      .finally(() => setTreeLoading(false));
  }, [activeWs?.path, setActiveProjectPath]);

  const handleSwitchProject = (id: string) => {
    selectProject(id);
    setActiveView('documents');
  };

  const handleNavClick = (id: ActiveView | 'chatHistory') => {
    if (id === 'chatHistory') {
      setSidebarMode('chatHistory');
    } else {
      setSidebarMode('nav');
      setActiveView(id);
    }
  };

  if (sidebarMode === 'chatHistory') {
    return (
      <aside className="sidebar workspace-sidebar" aria-label="Chat history" id="workspace-sidebar">
        <ChatHistoryPanel />
      </aside>
    );
  }

  return (
    <aside className="sidebar workspace-sidebar" aria-label="Project Navigator" id="workspace-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark"><VaelonLogo size={16} /></span>
        <span className="sidebar-brand-text">Vaelon</span>
      </div>
      <nav className="sidebar-section" aria-label="Main navigation">
        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group} className="sidebar-nav-group">
            <div className="sidebar-label">{group}</div>
            {items.map(({ id, label, Icon }) => {
              const isActive = id !== 'chatHistory' && activeView === id;
              return (
                <button
                  key={id}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(id)}
                  id={`sidebar-nav-${id}`}
                >
                  <span className="sidebar-item-icon"><Icon /></span>
                  {label}
                  {id === 'graph' && backgroundServices.indexer === 'active' && (
                    <span style={{ marginLeft: 'auto' }} className="live-badge active"><span className="dot" /></span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-divider" />

      {/* Active project header */}
      <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="sidebar-label">Active Project</div>
        {activeProject ? (
          <>
            <div className="pnav-project-item active">
              <span className="sidebar-item-icon"><IconFolder /></span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.name}
              </span>
              <span className="project-dot" style={{ background: activeProject.color || 'var(--accent)' }} />
            </div>
            {activeProject.description && (
              <span style={{ fontSize: 9, color: 'var(--tx-disabled)', padding: '0 var(--sp-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.description}
              </span>
            )}
          </>
        ) : (
          <div className="pnav-project-item active">
            <span className="sidebar-item-icon"><IconFolder /></span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeWs?.name || 'No workspace open'}
            </span>
          </div>
        )}
        {activeWs && <span style={{ fontSize: 9, color: 'var(--tx-disabled)', padding: '0 var(--sp-3)' }}>{activeWs.path}</span>}
      </div>

      {/* Project quick switcher */}
      {activeWs && projects.length > 0 && (
        <>
          <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
            <div className="sidebar-label">Projects</div>
          </div>
          <div style={{ padding: '0 var(--sp-2)' }}>
            {projects.map((project) => (
              <div
                key={project.id}
                className={`pnav-project-item ${project.id === activeProjectId ? 'active' : ''}`}
                onClick={() => handleSwitchProject(project.id)}
                title={project.description || project.name}
              >
                <span className="sidebar-item-icon"><IconFolder /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
                <span className="project-dot" style={{ background: project.color || 'var(--accent)' }} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Workspace switcher */}
      {workspaces.length > 1 && (
        <>
          <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
            <div className="sidebar-label">Workspaces</div>
          </div>
          <div style={{ padding: '0 var(--sp-2)' }}>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`pnav-project-item ${ws.id === activeWorkspaceId ? 'active' : ''}`}
                onClick={() => selectWorkspace(ws.id)}
              >
                <span className="sidebar-item-icon"><IconFolder /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                <span className="branch">main</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-divider" />

      {/* File tree */}
      <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
        <div className="sidebar-label">Files</div>
      </div>
      <div className="sidebar-file-tree" role="list" aria-label="Project file tree">
        {treeLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '16px', color: 'var(--tx-tertiary)' }}>
            <span>Indexing…</span>
          </div>
        )}
        {!treeLoading && fileTree.length === 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-disabled)', padding: '8px 16px', lineHeight: 1.5 }}>
            Open a project to browse its files. Files with{' '}
            <span className="file-git-status M">M</span>
            <span className="file-git-status U">U</span>
            <span className="file-git-status A">A</span> show git status.
          </p>
        )}
        {!treeLoading && fileTree.map((node) => (
          <FileRow key={node.path} node={node} depth={0} onOpen={() => setActiveView('terminal')} />
        ))}
      </div>

      {/* Recent documents */}
      {documents.length > 0 && (
        <>
          <div className="sidebar-divider" />
          <div style={{ padding: 'var(--sp-2) var(--sp-4)' }}>
            <div className="sidebar-label">Documents</div>
          </div>
          <div className="sidebar-file-tree">
            {documents.slice(0, 8).map((doc: Document) => (
              <div
                key={doc.id}
                className={`sidebar-item ${doc.id === activeDocumentId ? 'active' : ''}`}
                onClick={() => {
                  selectDocument(doc.id);
                  setActiveView('documents');
                }}
              >
                <span className="sidebar-item-icon" style={{ opacity: 0.6 }}><IconFile /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title || 'Untitled'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <footer className="sidebar-footer">
        <button className="sidebar-version-tag" style={{ width: '100%', justifyContent: 'center' }} onClick={onNewDocument}>
          <IconSearch /> Developer OS
        </button>
      </footer>
    </aside>
  );
}
