import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDocumentStore } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';
import { api, Project, ProjectMeta } from '../../ipc/client';
import './ProjectsView.css';

// ── Inline Icons ──────────────────────────────────────────────────────────────
const IconProject = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 5.5h5M4.5 8h5M4.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M1.5 3h9M4 3V1.5h4V3M2.5 3l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M1 1l10 10M11 1 1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconDoc = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 4.5h5M4 6.5h5M4 8.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M8.5 1.5 10.5 3.5 4 10l-2.5.5L2 8l6.5-6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 4.5h10a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H2a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 4.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const IconBack = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M5 1.5 1 6l4 4.5M1 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const COLORS = ['#0066CC', '#1AAE39', '#DD5B00', '#E03131', '#5E5CE6', '#FF2D55', '#64D2FF', '#8E8E93'];

const PALETTE_LABELS: Record<string, string> = {
  '#0066CC': 'Blue',
  '#1AAE39': 'Green',
  '#DD5B00': 'Orange',
  '#E03131': 'Red',
  '#5E5CE6': 'Indigo',
  '#FF2D55': 'Pink',
  '#64D2FF': 'Teal',
  '#8E8E93': 'Gray',
};

function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

// ── Create / Edit Modal ──────────────────────────────────────────────────────
interface ProjectFormModalProps {
  initial?: Project | null;
  onClose: () => void;
}

function ProjectFormModal({ initial, onClose }: ProjectFormModalProps) {
  const { createProject, updateProject, setProjectMeta } = useWorkspaceStore();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [folder, setFolder] = useState(initial?.path || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill the folder with the active workspace path on first open.
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  useEffect(() => {
    if (!initial && !folder) {
      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      if (ws?.path) setFolder(ws.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBrowseFolder = async () => {
    try {
      const path = await api.pickFolder();
      if (path) setFolder(path);
    } catch {
      // ignore errors
    }
  };

  // ── Project Identity fields ──
  const [identityOpen, setIdentityOpen] = useState(false);
  const [mission, setMission] = useState('');
  const [techStack, setTechStack] = useState('');
  const [architecture, setArchitecture] = useState('');
  const [codingStyle, setCodingStyle] = useState('');
  const [milestone, setMilestone] = useState('');
  const [priority, setPriority] = useState('');
  const [knownProblems, setKnownProblems] = useState('');

  // Load existing identity when editing.
  useEffect(() => {
    if (initial) {
      api.projectMetaGet(initial.id).then((meta) => {
        if (!meta) return;
        setMission(meta.mission);
        setTechStack(meta.tech_stack);
        setArchitecture(meta.architecture);
        setCodingStyle(meta.coding_style);
        setMilestone(meta.current_milestone);
        setPriority(meta.priority);
        setKnownProblems(meta.known_problems);
      }).catch(() => {});
    }
  }, [initial]);

  const saveIdentity = async (projectId: string) => {
    const meta: ProjectMeta = {
      project_id: projectId,
      mission: mission.trim(),
      tech_stack: techStack.trim(),
      architecture: architecture.trim(),
      coding_style: codingStyle.trim(),
      current_milestone: milestone.trim(),
      priority: priority.trim(),
      known_problems: knownProblems.trim(),
      updated_at: new Date().toISOString(),
    };
    await setProjectMeta(meta);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await updateProject(initial.id, { name: trimmed, description: description.trim(), color });
        await saveIdentity(initial.id);
      } else {
        await createProject(trimmed, description.trim());
        const newProjectId = useWorkspaceStore.getState().activeProjectId;
        if (newProjectId) {
          if (folder.trim()) {
            await updateProject(newProjectId, { path: folder.trim() });
          }
          await saveIdentity(newProjectId);
        }
      }
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save project');
      setSaving(false);
    }
  };

  return (
    <div className="project-modal-backdrop" onClick={onClose}>
      <div className="project-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} id="project-form-modal">
        <div className="project-modal-header">
          <div className="project-modal-title">{initial ? 'Edit Project' : 'New Project'}</div>
          <button className="btn btn-icon-sm btn-ghost" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>

        <label className="project-field-label" htmlFor="project-name">Name</label>
        <input
          id="project-name"
          className="project-input"
          placeholder="e.g. Vaelon Desktop"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <label className="project-field-label" htmlFor="project-folder">Folder</label>
        <div className="project-folder-input">
          <input
            id="project-folder"
            className="project-input"
            placeholder="C:\Users\you\projects\vaelon"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm project-folder-browse"
            onClick={handleBrowseFolder}
            aria-label="Browse folder"
          >
            <IconFolder />
          </button>
        </div>
        <p className="project-identity-hint">
          The folder on disk this project lives in. The agent reads this folder before it works.
        </p>

        <label className="project-field-label" htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          className="project-input project-textarea"
          placeholder="What is this project about?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <label className="project-field-label">Color</label>
        <div className="project-color-picker">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`project-color-swatch ${color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Use color ${PALETTE_LABELS[c] ?? c}`}
              title={PALETTE_LABELS[c] ?? c}
            />
          ))}
        </div>

        {/* ── Project Identity ── */}
        <button
          type="button"
          className="project-identity-toggle"
          onClick={() => setIdentityOpen((o) => !o)}
          id="project-identity-toggle"
        >
          <span>Advanced — Project Identity <span style={{ color: 'var(--tx-tertiary)', fontWeight: 600 }}>(optional)</span></span>
          <span className="project-identity-chevron">{identityOpen ? '▾' : '▸'}</span>
        </button>
        <p className="project-identity-hint">
          A profile every agent and chat session reads before acting. Change projects — the AI's
          knowledge changes with them. Optional — you can set this later.
        </p>

        {identityOpen && (
          <div className="project-identity-fields">
            <label className="project-field-label" htmlFor="project-mission">Mission</label>
            <textarea
              id="project-mission"
              className="project-input project-textarea"
              placeholder="Why does this project exist?"
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              rows={2}
            />
            <label className="project-field-label" htmlFor="project-techstack">Tech Stack</label>
            <input
              id="project-techstack"
              className="project-input"
              placeholder="Rust, Tauri, React, TypeScript"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
            />
            <label className="project-field-label" htmlFor="project-architecture">Architecture</label>
            <textarea
              id="project-architecture"
              className="project-input project-textarea"
              placeholder="Local-first, event-driven, agent-based"
              value={architecture}
              onChange={(e) => setArchitecture(e.target.value)}
              rows={2}
            />
            <label className="project-field-label" htmlFor="project-style">Coding Style</label>
            <textarea
              id="project-style"
              className="project-input project-textarea"
              placeholder="Minimal abstractions. Readable over clever."
              value={codingStyle}
              onChange={(e) => setCodingStyle(e.target.value)}
              rows={2}
            />
            <label className="project-field-label" htmlFor="project-milestone">Current Milestone</label>
            <input
              id="project-milestone"
              className="project-input"
              placeholder="MVP"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
            />
            <label className="project-field-label" htmlFor="project-priority">Priority</label>
            <input
              id="project-priority"
              className="project-input"
              placeholder="Speed &gt; Perfect architecture"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <label className="project-field-label" htmlFor="project-problems">Known Problems</label>
            <textarea
              id="project-problems"
              className="project-input project-textarea"
              placeholder="Planner context, streaming, indexing speed"
              value={knownProblems}
              onChange={(e) => setKnownProblems(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {error && <div className="project-form-error">{error}</div>}

        <div className="project-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!name.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Detail (docs list) ───────────────────────────────────────────────
function ProjectDetail({ project, onBack, onEdit }: { project: Project; onBack: () => void; onEdit: (p: Project) => void }) {
  const { documents, activeDocumentId, selectDocument, createDocument, loadDocuments } = useDocumentStore();
  const { activeWorkspaceId, projectMeta } = useWorkspaceStore();
  const { setActiveView } = useAppStore();

  // Load this project's documents whenever it's shown.
  useEffect(() => {
    if (activeWorkspaceId) {
      loadDocuments(activeWorkspaceId, project.id);
    }
  }, [activeWorkspaceId, project.id, loadDocuments]);

  const createDoc = async () => {
    if (!activeWorkspaceId) return;
    await createDocument(activeWorkspaceId, project.id, 'Untitled Document', 'knowledge');
    setActiveView('documents');
  };

  const openDoc = (id: string) => {
    selectDocument(id);
    setActiveView('documents');
  };

  return (
    <div className="project-detail animate-fade-in">
      <div className="project-detail-header">
        <button className="btn btn-secondary btn-sm" onClick={onBack} id="project-detail-back">
          <span className="btn-icon"><IconBack /></span>
          All projects
        </button>
        <span className="project-detail-dot" style={{ background: project.color || '#0066CC' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="project-detail-title">{project.name}</div>
          {project.description && (
            <div className="project-detail-desc">{project.description}</div>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(project)}>
          <span className="btn-icon"><IconEdit /></span>
          Edit
        </button>
        <button className="btn btn-primary btn-sm" onClick={createDoc} id="project-detail-new-doc">
          <span className="btn-icon"><IconPlus /></span>
          New Document
        </button>
      </div>

      <div className="project-detail-count">
        {documents.length} document{documents.length !== 1 ? 's' : ''} in this project
      </div>

      {projectMeta && (
        <div className="project-identity-card">
          {projectMeta.mission && (
            <div className="project-identity-row">
              <span className="project-identity-key">Mission</span>
              <span className="project-identity-val">{projectMeta.mission}</span>
            </div>
          )}
          {projectMeta.tech_stack && (
            <div className="project-identity-row">
              <span className="project-identity-key">Tech Stack</span>
              <span className="project-identity-val">{projectMeta.tech_stack}</span>
            </div>
          )}
          {projectMeta.architecture && (
            <div className="project-identity-row">
              <span className="project-identity-key">Architecture</span>
              <span className="project-identity-val">{projectMeta.architecture}</span>
            </div>
          )}
          {projectMeta.coding_style && (
            <div className="project-identity-row">
              <span className="project-identity-key">Coding Style</span>
              <span className="project-identity-val">{projectMeta.coding_style}</span>
            </div>
          )}
          {projectMeta.current_milestone && (
            <div className="project-identity-row">
              <span className="project-identity-key">Milestone</span>
              <span className="project-identity-val">{projectMeta.current_milestone}</span>
            </div>
          )}
          {projectMeta.priority && (
            <div className="project-identity-row">
              <span className="project-identity-key">Priority</span>
              <span className="project-identity-val">{projectMeta.priority}</span>
            </div>
          )}
          {projectMeta.known_problems && (
            <div className="project-identity-row">
              <span className="project-identity-key">Known Problems</span>
              <span className="project-identity-val">{projectMeta.known_problems}</span>
            </div>
          )}
          <div className="project-identity-foot">This profile is injected into every agent & chat session.</div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-icon"><IconDoc /></div>
          <div className="empty-state-title">No documents yet</div>
          <div className="empty-state-desc">Create the first document for “{project.name}” to start writing.</div>
          <button className="btn btn-primary" onClick={createDoc}>
            <span className="btn-icon"><IconPlus /></span>
            New Document
          </button>
        </div>
      ) : (
        <div className="project-doc-list">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`project-doc-row ${doc.id === activeDocumentId ? 'active' : ''}`}
              onClick={() => openDoc(doc.id)}
              role="button"
              tabIndex={0}
              id={`project-doc-${doc.id}`}
              onKeyDown={(e) => e.key === 'Enter' && openDoc(doc.id)}
            >
              <span className="project-doc-icon"><IconDoc /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="project-doc-title">{doc.title || 'Untitled'}</div>
                <div className="project-doc-preview">
                  {stripHtml(doc.content || '').slice(0, 120) || 'Empty document'}
                </div>
              </div>
              <span className="project-doc-time">Updated {timeAgo(doc.updated_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function ProjectsView() {
  const { workspaces, activeWorkspaceId, selectWorkspace, projects, activeProjectId, selectProject, deleteProject } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});

  // Load document counts per project.
  useEffect(() => {
    if (!activeWorkspaceId) {
      setDocCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const all = await api.noteList(activeWorkspaceId);
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const n of all) {
          counts[n.project_id] = (counts[n.project_id] ?? 0) + 1;
        }
        setDocCounts(counts);
      } catch {
        if (!cancelled) setDocCounts({});
      }
    })();
    return () => { cancelled = true; };
  }, [activeWorkspaceId, projects]);

  // Reset the open detail when the workspace changes.
  useEffect(() => {
    setOpenProjectId(null);
  }, [activeWorkspaceId]);

  const openProjectFromCard = (p: Project) => {
    selectProject(p.id);
    setOpenProjectId(p.id);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteProject(confirmDelete.id);
    if (openProjectId === confirmDelete.id) setOpenProjectId(null);
    setConfirmDelete(null);
  };

  const openProjectObj = projects.find((p) => p.id === openProjectId) ?? null;

  // If a project is open, show its detail (hub-style).
  if (openProjectObj) {
    return (
      <div className="projects-page animate-fade-in">
        <ProjectDetail
          project={openProjectObj}
          onBack={() => setOpenProjectId(null)}
          onEdit={setEditing}
        />
        {editing && <ProjectFormModal initial={editing} onClose={() => setEditing(null)} />}
      </div>
    );
  }

  return (
    <div className="projects-page animate-fade-in">
      <div className="projects-header">
        <div>
          <h1 className="projects-title">Projects</h1>
          <p className="projects-sub">Organize knowledge, research, and tasks into projects.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)} id="project-create-btn">
          <span className="btn-icon"><IconPlus /></span>
          New Project
        </button>
      </div>

      {/* Workspace selector */}
      <div className="projects-workspace-row">
        <span className="projects-workspace-label">Workspace</span>
        <select
          className="project-select"
          value={activeWorkspaceId ?? ''}
          onChange={(e) => selectWorkspace(e.target.value)}
          aria-label="Select workspace"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name || w.path}</option>
          ))}
        </select>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state" style={{ padding: '80px 0' }}>
          <div className="empty-state-icon"><IconProject /></div>
          <div className="empty-state-title">No projects yet</div>
          <div className="empty-state-desc">
            Create a project to group your documents, research, and tasks together.
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <span className="btn-icon"><IconPlus /></span>
            Create your first project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((p) => {
            const count = docCounts[p.id] ?? 0;
            const isActive = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                className={`project-card ${isActive ? 'active' : ''}`}
                onClick={() => openProjectFromCard(p)}
                role="button"
                tabIndex={0}
                id={`project-card-${p.id}`}
                onKeyDown={(e) => e.key === 'Enter' && openProjectFromCard(p)}
              >
                <div className="project-card-top">
                  <span className="project-card-color" style={{ background: p.color || '#0066CC' }} />
                  <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-icon-sm btn-ghost"
                      onClick={() => setEditing(p)}
                      aria-label="Edit project"
                      title="Edit"
                    >
                      <IconEdit />
                    </button>
                    <button
                      className="btn btn-icon-sm btn-ghost"
                      onClick={() => setConfirmDelete(p)}
                      aria-label="Delete project"
                      title="Delete"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>

                <div className="project-card-name">{p.name}</div>
                <div className="project-card-desc">{p.description || 'No description yet.'}</div>

                <div className="project-card-footer">
                  <span className="project-card-stat">
                    <IconDoc /> {count} document{count !== 1 ? 's' : ''}
                  </span>
                  <span className="project-card-time">Updated {timeAgo(p.updated_at)}</span>
                </div>

                {isActive && (
                  <div className="project-card-badge">Active</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="projects-hint">
        Click a project to open it and see its documents.
      </p>

      {/* Modals */}
      {showCreate && <ProjectFormModal onClose={() => setShowCreate(false)} />}
      {editing && <ProjectFormModal initial={editing} onClose={() => setEditing(null)} />}

      {confirmDelete && (
        <div className="project-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="project-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} id="project-delete-modal">
            <div className="project-modal-header">
              <div className="project-modal-title">Delete “{confirmDelete.name}”?</div>
              <button className="btn btn-icon-sm btn-ghost" onClick={() => setConfirmDelete(null)} aria-label="Close">
                <IconX />
              </button>
            </div>
            <p className="project-delete-note">
              This will permanently delete the project and all of its documents.
            </p>
            <div className="project-modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete} id="project-delete-confirm">
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
