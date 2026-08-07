import { useState, useEffect, useCallback } from 'react';
import { api, TimelineEvent } from '../../ipc/client';
import { useWorkspaceStore } from '../../store/workspaceStore';
import './TimelineView.css';

const KIND_LABELS: Record<string, string> = {
  commit: 'Commit',
  file_changed: 'File Changed',
  build_result: 'Build',
  error_detected: 'Error',
  agent: 'Agent',
  indexer: 'Indexer',
  service: 'Service',
};

const KIND_FILTERS = ['all', 'commit', 'file_changed', 'build_result', 'error_detected', 'agent', 'indexer'];

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function parsePayload(event: TimelineEvent): string {
  if (event.description) return event.description;
  if (!event.payload) return '';
  try {
    const parsed = JSON.parse(event.payload);
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return event.payload;
  }
}

export default function TimelineView() {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TimelineEvent | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const kinds = filter === 'all' ? undefined : [filter];
      const list = await api.timelineQuery(activeWorkspaceId, undefined, kinds);
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="timeline-page animate-fade-in">
      <div className="timeline-header">
        <div>
          <h1 className="timeline-title">Timeline</h1>
          <p className="timeline-subtitle">Workspace activity — commits, file changes, builds, and errors.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={load} disabled={loading} id="timeline-refresh">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="timeline-filters" role="tablist" aria-label="Filter timeline by kind">
        {KIND_FILTERS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            className={`timeline-filter ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(k)}
            id={`timeline-filter-${k}`}
          >
            {k === 'all' ? 'All' : KIND_LABELS[k] ?? k}
          </button>
        ))}
      </div>

      {error && (
        <div className="timeline-error">
          {error}
          <button className="btn btn-sm btn-secondary" onClick={load}>Retry</button>
        </div>
      )}

      {!activeWorkspaceId ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">✦</div>
          <div className="timeline-empty-title">No workspace selected</div>
          <div className="timeline-empty-desc">Open a workspace to see its activity timeline.</div>
        </div>
      ) : loading && events.length === 0 ? (
        <div className="timeline-loading">
          {[100, 90, 95, 80].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 12, width: `${w}%`, borderRadius: 6 }} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">✦</div>
          <div className="timeline-empty-title">No events yet</div>
          <div className="timeline-empty-desc">Commits, file changes, and build results will appear here as background services watch this workspace.</div>
        </div>
      ) : (
        <div className="timeline-list">
          {events.map((ev) => {
            const title = ev.title || KIND_LABELS[ev.kind] || ev.kind;
            const detail = parsePayload(ev);
            return (
              <div
                key={ev.id}
                className={`timeline-item ${selected?.id === ev.id ? 'selected' : ''}`}
                onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
                role="button"
                tabIndex={0}
                id={`timeline-event-${ev.id}`}
                onKeyDown={(e) => e.key === 'Enter' && setSelected(selected?.id === ev.id ? null : ev)}
              >
                <span className={`timeline-kind kind-${ev.kind}`}>{KIND_LABELS[ev.kind] ?? ev.kind}</span>
                <div className="timeline-item-body">
                  <div className="timeline-item-title">{title}</div>
                  <div className="timeline-item-detail">{detail || '—'}</div>
                  {selected?.id === ev.id && (
                    <pre className="timeline-item-payload">{ev.payload}</pre>
                  )}
                </div>
                <div className="timeline-item-time">
                  <div>{timeAgo(ev.created_at)}</div>
                  <div className="timeline-item-ts">{formatTimestamp(ev.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
