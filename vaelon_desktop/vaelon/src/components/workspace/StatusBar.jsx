import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';

export default function StatusBar({ wordCount = 0, charCount = 0 }) {
  const { syncState, theme, activeView, openCmd, openRightPanel } = useAppStore();
  const { activeNoteId, notes } = useNoteStore();

  const activeNote = notes.find(n => n.id === activeNoteId);
  const syncLabels = { synced: 'All changes saved', syncing: 'Saving…', offline: 'Offline' };
  const syncColors = { synced: 'var(--success)', syncing: 'var(--warning)', offline: 'var(--danger)' };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <footer className="statusbar workspace-statusbar" role="contentinfo" aria-label="Status bar">
      {/* Left — sync state */}
      <div className="statusbar-item">
        <span
          className="statusbar-dot"
          style={{
            background: syncColors[syncState] ?? 'var(--tx-disabled)',
            boxShadow: syncState === 'synced' ? `0 0 5px ${syncColors.synced}` : 'none',
          }}
        />
        <span>{syncLabels[syncState] ?? 'Ready'}</span>
      </div>

      {/* Separator */}
      <span style={{ color: 'var(--tx-disabled)', fontSize: '10px' }}>·</span>

      {/* View indicator */}
      <div className="statusbar-item">
        <span style={{ textTransform: 'capitalize' }}>{activeView}</span>
      </div>

      {/* Note stats when a note is open */}
      {activeNoteId && (
        <>
          <span style={{ color: 'var(--tx-disabled)', fontSize: '10px' }}>·</span>
          <div className="statusbar-item">
            <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
          <div className="statusbar-item">
            <span>{charCount} chars</span>
          </div>
        </>
      )}

      <div className="statusbar-spacer" />

      {/* Right — AI badge */}
      <button
        className="statusbar-badge"
        onClick={() => openRightPanel('chat')}
        style={{ cursor: 'pointer' }}
        title="Open AI Chat"
      >
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
          <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
        </svg>
        AI Ready
      </button>

      {/* Cmd+K shortcut hint */}
      <button
        className="statusbar-item"
        onClick={openCmd}
        style={{
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--tx-disabled)', display: 'flex', alignItems: 'center', gap: '3px',
        }}
        title="Open command palette"
      >
        <kbd style={{ padding: '0 4px', borderRadius: 3, border: '1px solid var(--border)', background: 'var(--bg-overlay)', lineHeight: '15px', fontSize: '9px' }}>⌘K</kbd>
      </button>

      {/* Theme & time */}
      <div className="statusbar-item" style={{ fontFamily: 'var(--font-mono)', gap: 6 }}>
        <span>{theme === 'dark' ? '◑' : '◐'}</span>
        <span style={{ opacity: .6 }}>{timeStr}</span>
      </div>
    </footer>
  );
}
