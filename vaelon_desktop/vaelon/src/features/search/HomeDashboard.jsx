import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';

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
const IconNote = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconStudy = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconCmd = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M5 3a2 2 0 1 0-2 2h2V3ZM5 3v8M9 11a2 2 0 1 0 2-2H9v2ZM9 11V3M3 9a2 2 0 1 0 2 2V9H3ZM11 5a2 2 0 1 0-2-2v2h2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M6.5 4v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6h7M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, colorClass, onClick }) {
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

// ── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onOpen }) {
  const plainText = note.content?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || '';
  return (
    <div className="note-card card-hoverable" onClick={() => onOpen(note.id)}>
      <div className="note-card-icon">
        <IconNote />
      </div>
      <div className="note-card-title">{note.title?.trim() || 'Untitled'}</div>
      <div className="note-card-preview">
        {plainText || <span style={{ fontStyle: 'italic', opacity: .6 }}>No content yet</span>}
      </div>
      {note.updatedAt && (
        <div className="note-card-meta">
          <IconClock />
          {timeAgo(note.updatedAt)}
        </div>
      )}
    </div>
  );
}

// ── Quick Action ──────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, sub, bg, color, onClick }) {
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function HomeDashboard({ onNewNote }) {
  const { setActiveView, openCmd, openRightPanel } = useAppStore();
  const { notes } = useNoteStore();

  const recentNotes = notes.slice(0, 6);

  const openNote = (id) => {
    useNoteStore.getState().setActiveNote(id);
    setActiveView('notes');
  };

  return (
    <div className="home-dashboard animate-fade-in">

      {/* ── Greeting hero ── */}
      <section className="home-greeting">
        <div className="home-greeting-eyebrow">
          <IconAI />
          AI-native knowledge workspace
        </div>

        <h1 className="home-greeting-title">
          {greeting()},<br />
          let's build <span className="gradient-text">something great.</span>
        </h1>

        <p className="home-greeting-sub">
          Capture ideas, generate AI summaries, quiz yourself, and connect knowledge — all in one place.
        </p>

        <div className="home-ctas">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => { onNewNote(); }}
            id="home-create-note"
          >
            <IconPlus />
            New Note
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={openCmd}
            id="home-search-cmd"
          >
            <IconSearch />
            Search &amp; Commands
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
          icon={IconNote}
          value={notes.length}
          label="Notes created"
          colorClass="purple"
          onClick={() => setActiveView('notes')}
        />
        <StatCard
          icon={IconStudy}
          value={notes.filter(n => n.content?.length > 50).length}
          label="Ready for study"
          colorClass="pink"
          onClick={() => setActiveView('study')}
        />
        <StatCard
          icon={IconAI}
          value="∞"
          label="AI sessions available"
          colorClass="rose"
          onClick={() => openRightPanel('chat')}
        />
      </div>

      {/* ── Quick actions ── */}
      <section style={{ marginBottom: 'var(--sp-10)' }}>
        <div className="recent-section-header">
          <h2 className="recent-section-title">Quick actions</h2>
        </div>
        <div className="quick-actions-grid">
          <QuickAction
            icon={IconNote}
            label="New Note"
            sub="Blank canvas"
            bg="hsla(258,88%,68%,.13)"
            color="var(--accent)"
            onClick={() => onNewNote()}
          />
          <QuickAction
            icon={IconAI}
            label="AI Chat"
            sub="Ask anything"
            bg="hsla(296,80%,62%,.13)"
            color="var(--accent-2)"
            onClick={() => openRightPanel('chat')}
          />
          <QuickAction
            icon={IconStudy}
            label="Study Center"
            sub="Quizzes & review"
            bg="hsla(340,85%,65%,.13)"
            color="var(--accent-3)"
            onClick={() => setActiveView('study')}
          />
          <QuickAction
            icon={IconCmd}
            label="Commands"
            sub="⌘K to open"
            bg="hsla(152,68%,50%,.13)"
            color="var(--success)"
            onClick={openCmd}
          />
        </div>
      </section>

      {/* ── Recent notes ── */}
      <section>
        <div className="recent-section-header">
          <h2 className="recent-section-title">Recent notes</h2>
          {notes.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveView('notes')}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}
            >
              View all <IconArrow />
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <IconNote />
            </div>
            <div className="empty-state-title">No notes yet</div>
            <div className="empty-state-desc">
              Create your first note to get started. Use the AI assistant to summarize, quiz yourself, or ask questions.
            </div>
            <button className="btn btn-primary" onClick={() => onNewNote()} id="empty-create-note">
              <IconPlus /> Create your first note
            </button>
          </div>
        ) : (
          <div className="recent-notes-grid">
            {recentNotes.map((note) => (
              <NoteCard key={note.id} note={note} onOpen={openNote} />
            ))}
          </div>
        )}
      </section>

      {/* ── Feature badges ── */}
      <section style={{ marginTop: 'var(--sp-16)', paddingTop: 'var(--sp-8)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
          {['✦ AI Summaries', '✓ Rich Text Editor', '⚡ PDF & File Support', '🔒 Secure & Private', '🎓 Self-Study Quizzes'].map(f => (
            <span key={f} className="hero-pill">{f}</span>
          ))}
        </div>
      </section>

    </div>
  );
}
