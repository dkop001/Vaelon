import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useDocumentStore, Document } from '../../store/noteStore';
import { DocumentType } from '../../store/noteStore';

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>
);
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
const IconDocument = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconResearch = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconTerminal = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M3.5 5L6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ComponentType;
  value: string | number;
  label: string;
  colorClass: string;
  onClick?: () => void;
}

function StatCard({ icon: Icon, value, label, colorClass, onClick }: StatCardProps) {
  return (
    <div className="stat-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className={`stat-card-icon ${colorClass}`}>
        <Icon />
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}

// ── Document Card ──────────────────────────────────────────────────────────────
interface DocumentCardProps {
  document: Document;
  onOpen: (id: string) => void;
}

function DocumentCard({ document, onOpen }: DocumentCardProps) {
  const plainText = document.content?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
  return (
    <div className="note-card card-hoverable" onClick={() => onOpen(document.id)}>
      <div className="note-card-icon">
        <IconDocument />
      </div>
      <div className="note-card-title">{document.title?.trim() || 'Untitled'}</div>
      <div className="note-card-preview">
        {plainText || <span style={{ fontStyle: 'italic', opacity: .6 }}>No content yet</span>}
      </div>
      {document.updated_at && (
        <div className="note-card-meta">
          <IconClock />
          {timeAgo(document.updated_at)}
        </div>
      )}
    </div>
  );
}

// ── Quick Action ───────────────────────────────────────────────────────────────
interface QuickActionProps {
  icon: React.ComponentType;
  label: string;
  sub?: string;
  bg: string;
  color: string;
  onClick: () => void;
}

function QuickAction({ icon: Icon, label, sub, bg, color, onClick }: QuickActionProps) {
  return (
    <div className="quick-action-card" onClick={onClick}>
      <div className="quick-action-icon" style={{ background: bg, color }}>
        <Icon />
      </div>
      <div>
        <div className="quick-action-label">{label}</div>
        {sub && <div className="quick-action-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
interface HomeDashboardProps {
  onNewNote: (type?: DocumentType) => void;
}

export default function HomeDashboard({ onNewNote }: HomeDashboardProps) {
  const { setActiveView, openCmd, openRightPanel } = useAppStore();
  const { documents } = useDocumentStore();

  const recentDocuments = documents.slice(0, 6);

  const openDocument = (id: string) => {
    useDocumentStore.getState().selectDocument(id);
    setActiveView('documents');
  };

  return (
    <div className="home-dashboard animate-fade-in">

      {/* ── Greeting hero ── */}
      <section className="home-greeting">
        <div className="home-greeting-eyebrow">
          <IconAI />
          AI-native developer workspace
        </div>

        <h1 className="home-greeting-title">
          {greeting()},<br />
          let's build <span className="gradient-text">something great.</span>
        </h1>

        <p className="home-greeting-sub">
          Research, plan, code, debug, document, and ship — all in one context-aware environment.
        </p>

        <div className="home-ctas">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => { onNewNote('knowledge'); }}
            id="home-create-note"
          >
            <IconPlus />
            New Document
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={openCmd}
            id="home-search-cmd"
          >
            <IconSearch />
            Search & Commands
            <span style={{
              marginLeft: 4, fontSize: '10px', fontFamily: 'var(--font-mono)',
              color: 'var(--tx-disabled)',
              padding: '1px 6px', borderRadius: 4,
              background: 'var(--bg-overlay)', border: '1px solid var(--border)',
            }}>⌘K</span>
          </button>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="home-stats">
        <StatCard
          icon={IconDocument}
          value={documents.length}
          label="Documents created"
          colorClass="purple"
          onClick={() => setActiveView('documents')}
        />
        <StatCard
          icon={IconResearch}
          value={documents.filter(d => d.type === 'research').length}
          label="Research entries"
          colorClass="pink"
          onClick={() => setActiveView('research')}
        />
        <StatCard
          icon={IconAI}
          value="∞"
          label="AI sessions available"
          colorClass="rose"
          onClick={() => openRightPanel('chat')}
        />
        <StatCard
          icon={IconTerminal}
          value="Ready"
          label="Terminal integration"
          colorClass="green"
          onClick={() => setActiveView('terminal')}
        />
      </div>

      {/* ── Quick actions ── */}
      <section style={{ marginBottom: 'var(--sp-10)' }}>
        <div className="recent-section-header">
          <h2 className="recent-section-title">Quick actions</h2>
        </div>
        <div className="quick-actions-grid">
          <QuickAction
            icon={IconDocument}
            label="New Knowledge Doc"
            sub="Architecture, decisions, notes"
            bg="hsla(258,88%,68%,.13)"
            color="var(--accent)"
            onClick={() => onNewNote('knowledge')}
          />
          <QuickAction
            icon={IconResearch}
            label="New Research Doc"
            sub="Sources, comparisons, findings"
            bg="hsla(340,85%,65%,.13)"
            color="var(--accent-3)"
            onClick={() => onNewNote('research')}
          />
          <QuickAction
            icon={IconAI}
            label="AI Chat"
            sub="Ask about your project"
            bg="hsla(296,80%,62%,.13)"
            color="var(--accent-2)"
            onClick={() => openRightPanel('chat')}
          />
          <QuickAction
            icon={IconTerminal}
            label="Terminal"
            sub="Integrated shell"
            bg="hsla(152,68%,50%,.13)"
            color="var(--success)"
            onClick={() => setActiveView('terminal')}
          />
        </div>
      </section>

      {/* ── Recent documents ── */}
      <section>
        <div className="recent-section-header">
          <h2 className="recent-section-title">Recent documents</h2>
        </div>
        {recentDocuments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-12)', color: 'var(--tx-tertiary)' }}>
            <div style={{ fontSize: 32, marginBottom: 'var(--sp-4)', opacity: .4 }}>
              <IconDocument />
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 4 }}>No documents yet</div>
            <div style={{ fontSize: 'var(--text-sm)', maxWidth: 300, margin: '0 auto' }}>
              Create your first document to get started.
            </div>
          </div>
        ) : (
          <div className="note-grid">
            {recentDocuments.map(doc => (
              <DocumentCard key={doc.id} document={doc} onOpen={openDocument} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}