import { useEffect, useState } from 'react';
import { useAppStore, BackgroundServices } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDocumentStore } from '../../store/noteStore';
import { api, onEvent } from '../../ipc/client';
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
const IconGit = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 3h4.5a2 2 0 0 1 2 2v4.5M3 4.5v4.5a1.5 1.5 0 0 0 1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconBuild = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 11h10M5 11V5M9 11V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5 5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconAgent = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

interface TimelineEvent {
  id: string;
  kind: string;
  title?: string;
  description?: string;
  workspace_id: string;
  created_at: string;
}

const KIND_LABELS: Record<string, { label: string; signal: 'info' | 'success' | 'warning' | 'danger' }> = {
  commit:         { label: 'GIT',    signal: 'success' },
  file_changed:   { label: 'FILES',  signal: 'info' },
  build_result:   { label: 'BUILD',  signal: 'warning' },
  error_detected: { label: 'ERROR',  signal: 'danger' },
  agent:          { label: 'AGENT',  signal: 'info' },
  memory:         { label: 'MEMORY', signal: 'info' },
};

// ── Health row ────────────────────────────────────────────────────────────────
function HealthRow({ label, status, icon }: { label: string; status: string; icon: React.ReactNode }) {
  const tone = status === 'active' ? 'ok' : status === 'error' ? 'bad' : status === 'starting' ? 'busy' : 'idle';
  const text = status === 'active' ? 'Live' : status === 'starting' ? 'Starting' : status === 'error' ? 'Attention' : 'Standby';
  return (
    <div className="health-row">
      <span className={`health-signal ${tone}`} aria-hidden="true" />
      <span className="health-icon">{icon}</span>
      <span className="health-label">{label}</span>
      <span className="health-state">{text}</span>
    </div>
  );
}

// ── Activity stream item ──────────────────────────────────────────────────────
function ActivityItem({ event }: { event: TimelineEvent }) {
  const meta = KIND_LABELS[event.kind] ?? { label: event.kind.toUpperCase(), signal: 'info' as const };
  const time = new Date(event.created_at);
  const timeStr = isNaN(time.getTime())
    ? ''
    : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="activity-row">
      <span className="activity-time">{timeStr}</span>
      <span className={`activity-kind signal-${meta.signal}`}>{meta.label}</span>
      <span className="activity-text">{event.title || event.description || event.kind}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MissionControl() {
  const { setActiveView, openCmd, backgroundServices } = useAppStore();
  const { workspaces, activeWorkspaceId, projectMeta, getActiveProject, getActiveWorkspace } = useWorkspaceStore();
  const { documents } = useDocumentStore();
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'working' | 'thinking' | 'error'>('idle');

  useEffect(() => {
    const load = async () => {
      try {
        const events = await api.timelineQuery(activeWorkspaceId ?? '', undefined, undefined);
        setTimeline(Array.isArray(events) ? events : []);
      } catch {
        setTimeline([]);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [activeWorkspaceId]);

  useEffect(() => {
    const unsub1 = onEvent<{ status: 'inactive' | 'active' | 'error' | 'starting' }>('indexer:status', ({ status }) => {
      useAppStore.getState().setBackgroundService('indexer', status);
    });
    const unsub2 = onEvent<{ status: 'inactive' | 'active' | 'error' | 'starting' }>('git:status', ({ status }) => {
      useAppStore.getState().setBackgroundService('gitWatcher', status);
    });
    const unsub3 = onEvent<{ status: 'idle' | 'working' | 'thinking' | 'error' }>('agent:status', ({ status }) => {
      setAgentStatus(status);
      useAppStore.getState().setBackgroundService('agent', status === 'idle' ? 'inactive' : 'active');
    });
    const unsub4 = onEvent<{ status: 'inactive' | 'active' | 'error' | 'starting' }>('builds:status', ({ status }) => {
      useAppStore.getState().setBackgroundService('buildWatcher', status);
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const activeProject = getActiveProject();
  const activeWs = getActiveWorkspace();
  const projectName = activeProject?.name || activeWs?.name || 'No project open';

  // Fresh project? Show a "what's next" checklist instead of leaving the user stranded.
  const projectIsNew = !projectMeta?.mission && documents.length === 0;
  const steps = [
    { label: 'Set your project\'s Mission so agents know the goal', done: !!projectMeta?.mission, view: 'projects' as const },
    { label: 'Create your first document', done: documents.length > 0, view: 'documents' as const },
    { label: 'Write or import a note and let the indexer watch the folder', done: timeline.some((e) => e.kind === 'indexer' || e.kind === 'memory'), view: 'timeline' as const },
    { label: 'Give the agent its first task', done: timeline.some((e) => e.kind === 'agent'), view: 'agent' as const },
  ];

  const techStack = projectMeta?.tech_stack
    ?.split(',').map((s) => s.trim()).filter(Boolean)
    ?? [];

  const health: { id: keyof BackgroundServices; label: string; icon: React.ReactNode; status: string }[] = [
    { id: 'agent', label: 'Agent', icon: <IconAgent />, status: agentStatus === 'idle' ? 'inactive' : 'active' },
    { id: 'gitWatcher', label: 'Git', icon: <IconGit />, status: backgroundServices.gitWatcher },
    { id: 'indexer', label: 'Indexer', icon: <IconFolder />, status: backgroundServices.indexer },
    { id: 'buildWatcher', label: 'Build', icon: <IconBuild />, status: backgroundServices.buildWatcher },
  ];

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
      {projectIsNew && (
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
      )}

      {/* ── Body: health rail + activity stream ── */}
      <div className="mc-body">
        {/* Project health */}
        <section className="mc-health">
          <div className="mc-section-label">Project Health</div>
          <div className="mc-health-list">
            {health.map((h) => (
              <HealthRow key={h.id} label={h.label} status={h.status} icon={h.icon} />
            ))}
          </div>
          <div className="mc-health-stats">
            <div className="mc-stat">
              <span className="mc-stat-value">{workspaces.length}</span>
              <span className="mc-stat-label">Projects</span>
            </div>
            <div className="mc-stat">
              <span className="mc-stat-value">{documents.length}</span>
              <span className="mc-stat-label">Files</span>
            </div>
            <div className="mc-stat">
              <span className="mc-stat-value">{timeline.length}</span>
              <span className="mc-stat-label">Events</span>
            </div>
          </div>
        </section>

        {/* Activity stream */}
        <section className="mc-stream">
          <div className="mc-section-label">
            Activity
            <button className="btn btn-sm btn-ghost" onClick={() => setActiveView('timeline')}>View all</button>
          </div>
          {timeline.length === 0 ? (
            <div className="mc-empty">
              <IconAgent />
              <span>No activity yet — commits, builds, and agent actions will appear here.</span>
            </div>
          ) : (
            <div className="mc-stream-list">
              {timeline.slice(0, 14).map((ev) => (
                <ActivityItem key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
