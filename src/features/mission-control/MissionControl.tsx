import { useAppStore } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDocumentStore } from '../../store/noteStore';
import VaelonLogo from '../../components/VaelonLogo';
import './MissionControl.css';

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconFolder = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IconAgent = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MissionControl() {
  const { setActiveView, openCmd } = useAppStore();
  const { projectMeta, getActiveProject, getActiveWorkspace } = useWorkspaceStore();
  const { documents } = useDocumentStore();

  const activeProject = getActiveProject();
  const activeWs = getActiveWorkspace();
  const projectName = activeProject?.name || activeWs?.name || 'No project open';

  const steps = [
    { label: 'Set your project\'s Mission so agents know the goal', done: !!projectMeta?.mission, view: 'projects' as const },
    { label: 'Create your first document', done: documents.length > 0, view: 'documents' as const },
    { label: 'Write or import a note and let the indexer watch the folder', done: false, view: 'timeline' as const },
    { label: 'Give the agent its first task', done: false, view: 'agent' as const },
  ];

  const techStack = projectMeta?.tech_stack
    ?.split(',').map((s) => s.trim()).filter(Boolean)
    ?? [];

  return (
    <div className="mc-root animate-fade-in">
      {/* ── Command center header ── */}
      <header className="mc-header">
        <div className="mc-brand">
          <span className="mc-brand-mark"><VaelonLogo size={22} /></span>
          <span className="mc-brand-word">VAELON</span>
          <span className="mc-brand-slash">/</span>
          <span className="mc-brand-surface">MISSION CONTROL</span>
        </div>

        <h1 className="mc-title">{projectName}</h1>
        <p className="mc-subtitle">
          {projectMeta?.mission || 'Developer Operating System — continuous awareness of this project.'}
        </p>

        <div className="mc-meta">
          {techStack.length > 0 && (
            <span className="mc-tech">{techStack.map((t) => (
              <code key={t}>{t}</code>
            ))}</span>
          )}
          {projectMeta?.current_milestone && (
            <span className="mc-milestone">
              <span className="mc-milestone-dot" /> Active milestone · {projectMeta.current_milestone}
            </span>
          )}
        </div>

        <div className="mc-actions">
          <button className="btn btn-primary btn-lg" onClick={openCmd} id="mc-open-cmd">
            <IconSearch /> Run Command <span className="mc-kbd">⌘K</span>
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => setActiveView('projects')} id="mc-projects">
            <IconFolder /> Open Project
          </button>
        </div>
      </header>

      {/* ── Fresh-project checklist ── */}
      <div className="mc-checklist" id="mc-checklist">
        <div className="mc-checklist-title">
          <IconAgent />
          <span>Get started — here's your path through Vaelon</span>
        </div>
        <div className="mc-checklist-steps">
          {steps.map((s, i) => (
            <button
              key={i}
              className={`mc-checklist-step ${s.done ? 'done' : ''}`}
              onClick={() => setActiveView(s.view)}
            >
              <span className="mc-checklist-num">{s.done ? '✓' : i + 1}</span>
              <span className="mc-checklist-label">{s.label}</span>
              <span className="mc-checklist-go">Open →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
