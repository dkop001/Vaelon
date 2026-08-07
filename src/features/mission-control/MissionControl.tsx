import { useEffect, useState } from 'react';
import { useAppStore, BackgroundServices } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useDocumentStore } from '../../store/noteStore';
import { api, onEvent } from '../../ipc/client';
import './MissionControl.css';

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
  </svg>
);
const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IconGit = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="11" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 3h4.5a2 2 0 0 1 2 2v4.5M3 4.5v4.5a1.5 1.5 0 0 0 1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconTerminal = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3.5 5 6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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

// ── Service Row ──────────────────────────────────────────────────────────────
function ServiceRow({ label, status, icon }: { label: string; status: BackgroundServices[keyof BackgroundServices]; icon: React.ReactNode }) {
  return (
    <div className="service-row">
      <div className="service-icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="service-name">{label}</div>
        <div className="service-sub">{status === 'active' ? 'Watching for changes' : status === 'starting' ? 'Starting…' : status === 'error' ? 'Needs attention' : 'Standby'}</div>
      </div>
      <span className={`live-badge ${status}`}>
        <span className="dot" />
        {status === 'active' ? 'Live' : status === 'starting' ? 'Starting' : status === 'error' ? 'Error' : 'Idle'}
      </span>
    </div>
  );
}

// ── Timeline Item ─────────────────────────────────────────────────────────────
function TimelineItem({ event }: { event: TimelineEvent }) {
  const timeAgo = () => {
    const diff = (Date.now() - new Date(event.created_at).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  return (
    <div className="timeline-row">
      <span className={`timeline-kind kind-${event.kind}`}>{event.kind}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="timeline-title">{event.title || event.description || event.kind}</div>
        <div className="timeline-sub">{event.workspace_id}</div>
      </div>
      <span className="timeline-time">{timeAgo()}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MissionControl() {
  const { setActiveView, openCmd, openRightPanel, backgroundServices, activeProjectPath } = useAppStore();
  const { workspaces, activeWorkspaceId, selectWorkspace } = useWorkspaceStore();
  const { documents } = useDocumentStore();
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'working' | 'thinking' | 'error'>('idle');

  // Load timeline events
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

  // Subscribe to service + agent events
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

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeProjectName = activeProjectPath?.split(/[\\/]/).pop() || activeWs?.name || 'No project open';

  const services: { id: keyof BackgroundServices; label: string; icon: React.ReactNode }[] = [
    { id: 'indexer', label: 'File Indexer', icon: <IconFolder /> },
    { id: 'gitWatcher', label: 'Git Watcher', icon: <IconGit /> },
    { id: 'buildWatcher', label: 'Build Watcher', icon: <IconTerminal /> },
    { id: 'agent', label: 'Background Agent', icon: <IconAI /> },
  ];

  return (
    <div className="home-dashboard animate-fade-in">
      {/* ── Greeting hero ── */}
      <section className="home-greeting">
        <div className="home-greeting-eyebrow">
          <IconAI />
          Developer Operating System
        </div>

        <h1 className="home-greeting-title">
          Mission Control<br />
          <span className="gradient-text">{activeProjectName}</span>
        </h1>

        <p className="home-greeting-sub">
          Persistent intelligence, live project status, and always-on background services — everything your dev environment knows, in one place.
        </p>

        <div className="home-ctas">
          <button className="btn btn-primary btn-lg" onClick={openCmd} id="mc-open-cmd">
            <IconSearch />
            Search &amp; Commands
            <span style={{ marginLeft: 4, fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--tx-disabled)', padding: '1px 6px', borderRadius: 4, background: 'var(--bg-overlay)', border: '1px solid var(--border)' }}>⌘K</span>
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => setActiveView('projects')} id="mc-projects">
            <IconFolder />
            Open Project
          </button>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="home-stats">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveView('graph')}>
          <div className="stat-card-icon purple"><IconFolder /></div>
          <div className="stat-card-value">{workspaces.length}</div>
          <div className="stat-card-label">Projects</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveView('timeline')}>
          <div className="stat-card-icon pink"><IconClock /></div>
          <div className="stat-card-value">{timeline.length}</div>
          <div className="stat-card-label">Timeline Events</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveView('documents')}>
          <div className="stat-card-icon rose"><IconAI /></div>
          <div className="stat-card-value">{documents.length}</div>
          <div className="stat-card-label">Documents</div>
        </div>
      </div>

      {/* ── Projects + Services grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)', marginBottom: 'var(--sp-8)' }}>
        {/* Active projects */}
        <section>
          <div className="recent-section-header">
            <h2 className="recent-section-title">Active Projects</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {workspaces.length === 0 && (
              <div className="empty-state" style={{ padding: 'var(--sp-12) 0' }}>
                <div className="empty-state-icon"><IconFolder /></div>
                <div className="empty-state-title">No projects yet</div>
                <div className="empty-state-desc">Open a project folder to start building its knowledge graph.</div>
              </div>
            )}
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`pnav-project-item ${ws.id === activeWorkspaceId ? 'active' : ''}`}
                onClick={() => selectWorkspace(ws.id)}
              >
                <span className="sidebar-item-icon"><IconFolder /></span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name || ws.path}</span>
                <span className="branch">main</span>
              </div>
            ))}
          </div>
        </section>

        {/* Background services */}
        <section>
          <div className="recent-section-header">
            <h2 className="recent-section-title">Background Services</h2>
          </div>
          <div className="intel-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {services.map((s) => (
              <ServiceRow key={s.id} label={s.label} status={backgroundServices[s.id]} icon={s.icon} />
            ))}
          </div>
        </section>
      </div>

      {/* ── Timeline + Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-8)' }}>
        <section>
          <div className="recent-section-header">
            <h2 className="recent-section-title">Recent Timeline</h2>
            <button className="btn btn-sm btn-secondary" onClick={() => setActiveView('timeline')}>View all</button>
          </div>
          <div className="intel-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', maxHeight: 280, overflowY: 'auto' }}>
            {timeline.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--tx-tertiary)', fontSize: 'var(--text-sm)' }}>
                <IconClock /> No events yet
              </div>
            )}
            {timeline.slice(0, 8).map((ev) => (
              <TimelineItem key={ev.id} event={ev} />
            ))}
          </div>
        </section>

        <section>
          <div className="recent-section-header">
            <h2 className="recent-section-title">Agent Status</h2>
          </div>
          <div className="intel-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
              <div className="agent-indicator-bar" style={{ fontSize: 'var(--text-xs)' }}>
                <span className="dot" />
                {agentStatus === 'working' ? 'Working…' : agentStatus === 'thinking' ? 'Thinking…' : agentStatus === 'error' ? 'Error' : 'Idle'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-tertiary)' }}>
                {agentStatus === 'working' ? 'Linting and fixing issues' : agentStatus === 'thinking' ? 'Analyzing architecture' : 'Waiting for work'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => openRightPanel('chat')}><IconAI /> Ask Assistant</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setActiveView('graph')}>View Graph</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
