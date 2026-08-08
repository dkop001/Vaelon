import { useState, useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { useAgentMemoryStore } from '../../store/agentMemoryStore';
import { MemoryEntry, MemoryType, MemorySource } from '../../ipc/client';
import './MemoryView.css';

const TYPE_LABELS: Record<MemoryType, string> = {
  'architecture': 'Architecture',
  'patterns': 'Patterns & Conventions',
  'coding-style': 'Coding Style',
  'tech-stack': 'Tech Stack',
  'mistakes': 'Common Mistakes',
  'conversations': 'Past Conversations',
  'folder-structure': 'Folder Structure',
  'completed-tasks': 'Completed Tasks',
  'decisions': 'Decisions & Rationale',
  'custom': 'Custom',
};

const GROUP_ORDER: MemoryType[] = [
  'decisions', 'mistakes', 'architecture', 'tech-stack', 'coding-style',
  'patterns', 'folder-structure', 'completed-tasks', 'conversations', 'custom',
];

const SOURCE_BADGE: Record<MemorySource, { label: string; cls: string }> = {
  'user-confirmed': { label: 'Confirmed', cls: 'confirmed' },
  'ai-inferred': { label: 'Inferred', cls: 'inferred' },
  'agent-observed': { label: 'Observed', cls: 'observed' },
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return `${days}d ago`;
}

function isStale(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / 86400000 > 30;
}

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M8.5 1.5 10.5 3.5 4 10l-2.5.5L2 8l6.5-6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
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
const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6.5 4.5 9 10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconMemory = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

// ── Single memory row ───────────────────────────────────────────────────────
function MemoryRow({ entry, onSaved }: { entry: MemoryEntry; onSaved: () => void }) {
  const { updateMemory, deleteMemory, confirmMemory } = useAgentMemoryStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.value);
  const [confirming, setConfirming] = useState(false);

  const badge = SOURCE_BADGE[entry.source] ?? SOURCE_BADGE['ai-inferred'];

  const saveEdit = async () => {
    await updateMemory(entry.id, draft);
    setEditing(false);
    onSaved();
  };

  const doConfirm = async () => {
    setConfirming(true);
    await confirmMemory(entry.id);
    setConfirming(false);
    onSaved();
  };

  return (
    <div className={`memory-row stale-${isStale(entry.updated_at) ? 'true' : 'false'}`}>
      <div className="memory-row-head">
        <span className="memory-type-tag">{TYPE_LABELS[entry.type] ?? entry.type}</span>
        <span className={`memory-source-badge ${badge.cls}`}>{badge.label}</span>
        <span className="memory-time" title={`Updated ${new Date(entry.updated_at).toLocaleString()}`}>
          {timeAgo(entry.updated_at)}
          {isStale(entry.updated_at) && ' · stale'}
        </span>
        <span style={{ flex: 1 }} />
        {entry.source !== 'user-confirmed' && (
          <button className="memory-row-action confirm" onClick={doConfirm} disabled={confirming} title="Confirm as fact">
            <IconCheck /> Confirm
          </button>
        )}
        <button className="memory-row-action" onClick={() => { setDraft(entry.value); setEditing(true); }} title="Edit">
          <IconEdit />
        </button>
        <button className="memory-row-action danger" onClick={() => deleteMemory(entry.id)} title="Delete">
          <IconTrash />
        </button>
      </div>

      {entry.key && <div className="memory-key">{entry.key}</div>}

      {editing ? (
        <div className="memory-edit">
          <textarea
            className="memory-edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="memory-edit-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={!draft.trim()}>Save</button>
          </div>
        </div>
      ) : (
        <div className="memory-value">{entry.value}</div>
      )}

      {entry.origin_session_id && (
        <div className="memory-origin" title={`Session ${entry.origin_session_id}`}>
          from session {entry.origin_session_id.slice(0, 8)}
        </div>
      )}
    </div>
  );
}

// ── Add-memory modal ────────────────────────────────────────────────────────
function AddMemoryModal({ onClose }: { onClose: () => void }) {
  const { setMemory } = useAgentMemoryStore();
  const { activeWorkspaceId, activeProjectId } = useWorkspaceStore();
  const [type, setType] = useState<MemoryType>('custom');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!value.trim() || !activeWorkspaceId || !activeProjectId) return;
    setSaving(true);
    await setMemory({
      project_id: activeProjectId,
      workspace_id: activeWorkspaceId,
      type,
      key: key.trim(),
      value: value.trim(),
      context: 'Manually added by user',
      source: 'user-confirmed',
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="memory-modal-backdrop" onClick={onClose}>
      <div className="memory-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="memory-modal-header">
          <div className="memory-modal-title">Add to Project Memory</div>
          <button className="btn btn-icon-sm btn-ghost" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <label className="memory-field-label" htmlFor="memory-type">Type</label>
        <select
          id="memory-type"
          className="memory-input"
          value={type}
          onChange={(e) => setType(e.target.value as MemoryType)}
        >
          {GROUP_ORDER.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>

        <label className="memory-field-label" htmlFor="memory-key">Key (optional)</label>
        <input
          id="memory-key"
          className="memory-input"
          placeholder="e.g. State management"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />

        <label className="memory-field-label" htmlFor="memory-value">What should the AI know?</label>
        <textarea
          id="memory-value"
          className="memory-input memory-textarea"
          placeholder="We use Zustand, not Redux."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          autoFocus
        />

        <div className="memory-modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!value.trim() || saving || !activeProjectId} title={activeProjectId ? undefined : 'Select a project first'}>
            {saving ? 'Saving…' : 'Save Memory'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────
export default function MemoryView() {
  const { activeWorkspaceId, activeProjectId } = useWorkspaceStore();
  const { memories, loading, loadMemories, autoCapture, setAutoCapture, loadAutoCapture } = useAgentMemoryStore();
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<MemorySource | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const addSignal = useAppStore((s) => s.memoryAddSignal);

  useEffect(() => {
    if (activeWorkspaceId) {
      loadMemories(activeProjectId ?? '', activeWorkspaceId).catch(() => {});
    }
    loadAutoCapture().catch(() => {});
    // Open the add modal when a Command Palette "Add Memory" action fired.
    if (addSignal > 0) {
      useAppStore.getState().consumeMemoryAdd();
      setShowAdd(true);
    }
  }, [activeWorkspaceId, activeProjectId, loadMemories, addSignal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memories.filter((m) => {
      if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
      if (q) {
        const hay = `${m.key} ${m.value} ${m.type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [memories, search, sourceFilter]);

  const reviewItems = memories.filter((m) => m.source !== 'user-confirmed');
  const groups = useMemo(() => {
    return GROUP_ORDER
      .map((t) => ({ type: t, items: filtered.filter((m) => m.type === t) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <div className="memory-page animate-fade-in">
      <div className="memory-header">
        <div>
          <h1 className="memory-title">Project Memory</h1>
          <p className="memory-sub">Everything the AI believes about this project. Confirm, edit, or delete entries so it only acts on what's true.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <label className="memory-auto-capture" title="When on, chat and agent runs automatically suggest memory entries for the review queue.">
            <input
              type="checkbox"
              checked={autoCapture}
              onChange={(e) => setAutoCapture(e.target.checked)}
              aria-label="Auto-capture memory"
            />
            Auto-capture
          </label>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)} id="memory-add-btn">
            <span className="btn-icon"><IconPlus /></span>
            Add Memory
          </button>
        </div>
      </div>

      {/* Review queue — auto-captured entries awaiting confirmation */}
      {reviewItems.length > 0 && (
        <div className="memory-review-card">
          <div className="memory-review-head">
            <span className="memory-review-title">Review queue — {reviewItems.length} auto-captured</span>
            <span className="memory-review-hint">The agent or chat captured these. Confirm what's true, delete what's not.</span>
          </div>
          <div className="memory-review-list">
            {reviewItems.map((m) => (
              <MemoryRow key={m.id} entry={m} onSaved={() => {}} />
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="memory-controls">
        <input
          className="memory-search"
          placeholder="Search memory…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="memory-filter"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as MemorySource | 'all')}
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="user-confirmed">Confirmed</option>
          <option value="ai-inferred">Inferred</option>
          <option value="agent-observed">Observed</option>
        </select>
      </div>

      {/* Empty / loading */}
      {loading && (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-desc">Loading memory…</div>
        </div>
      )}
      {!loading && memories.length === 0 && (
        <div className="empty-state" style={{ padding: '70px 0' }}>
          <div className="empty-state-icon"><IconMemory /></div>
          <div className="empty-state-title">No memory yet</div>
          <div className="empty-state-desc">
            Memory grows automatically as you use the agent and chat. Add the first entry now, or
            let a completed agent run capture what it learned.
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <span className="btn-icon"><IconPlus /></span>
            Add Memory
          </button>
        </div>
      )}
      {!loading && memories.length > 0 && groups.length === 0 && (
        <div className="empty-state" style={{ padding: '50px 0' }}>
          <div className="empty-state-desc">No entries match your filters.</div>
        </div>
      )}

      {/* Grouped memory */}
      {groups.map((g) => (
        <div key={g.type} className="memory-group">
          <div className="memory-group-head">
            <span className="memory-group-title">{TYPE_LABELS[g.type]}</span>
            <span className="memory-group-count">{g.items.length}</span>
          </div>
          <div className="memory-group-list">
            {g.items.map((m) => (
              <MemoryRow key={m.id} entry={m} onSaved={() => {}} />
            ))}
          </div>
        </div>
      ))}

      {showAdd && <AddMemoryModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
