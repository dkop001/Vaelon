import { useAppStore } from '../../store/appStore';
import { useAuth } from '../../context/AuthContext';

// ── Icons ──────────────────────────────────────────────────────────────────────
const IconMenu = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M1.5 3h12M1.5 7.5h12M1.5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
    <path d="m8.5 8.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1.5 8.6 4.9H12l-2.7 2 1 3.4L7.5 8.4l-2.8 1.9 1-3.4L3 4.9h3.4L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
);
const IconMoon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M12.5 9A5.5 5.5 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSun = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M10.01 3.99 11.07 2.93M2.93 11.07l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7 1v1M7 12v1M1 7H2M12 7h1M2.34 2.34l.7.7M10.96 10.96l.7.7M11.66 2.34l-.7.7M3.04 10.96l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconLogOut = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5M9 4l3 3-3 3M13 7H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconNoteAI = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
  </svg>
);

// ── SyncBadge ──────────────────────────────────────────────────────────────────
type SyncState = 'synced' | 'syncing' | 'offline';

function SyncBadge({ state }: { state: SyncState }) {
  const labels: Record<SyncState, string> = { synced: 'Saved', syncing: 'Saving…', offline: 'Offline' };
  return (
    <div className="topbar-sync-badge">
      <span className={`topbar-sync-dot ${state}`} />
      <span>{labels[state] ?? 'Saved'}</span>
    </div>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────────
type ActiveView = 'home' | 'notes' | 'study' | 'search' | 'settings' | 'chatHistory';

function Breadcrumb({ activeView, noteTitle }: { activeView: ActiveView; noteTitle?: string }) {
  const viewLabels: Record<string, string> = {
    home: 'Home', notes: 'Notes', study: 'Study', search: 'Search',
    settings: 'Settings', chatHistory: 'Chat History',
  };
  const viewLabel = viewLabels[activeView] ?? activeView;
  return (
    <nav className="topbar-breadcrumb" aria-label="breadcrumb">
      <span className="topbar-breadcrumb-item">Note AI</span>
      <span className="topbar-breadcrumb-sep">›</span>
      <span className={`topbar-breadcrumb-item ${!noteTitle ? 'current' : ''}`}>{viewLabel}</span>
      {noteTitle && (
        <>
          <span className="topbar-breadcrumb-sep">›</span>
          <span className="topbar-breadcrumb-item current">{noteTitle}</span>
        </>
      )}
    </nav>
  );
}

// ── TopBar ─────────────────────────────────────────────────────────────────────
interface TopBarProps {
  noteTitle?: string;
  onSettingsOpen: () => void;
}

export default function TopBar({ noteTitle, onSettingsOpen }: TopBarProps) {
  const {
    theme, toggleTheme, toggleSidebar, openCmd,
    rightPanelOpen, toggleRightPanel, syncState, activeView,
    toggleMobileSidebar, setActiveMode, activeMode,
  } = useAppStore();
  const { user, signOut } = useAuth();

  const initials = user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <header className="topbar workspace-topbar" role="banner">
      {/* Hamburger (mobile) */}
      <button
        className="topbar-btn mobile-only"
        onClick={toggleMobileSidebar}
        aria-label="Toggle sidebar"
        id="mobile-sidebar-toggle"
      >
        <IconMenu />
      </button>

      {/* Hamburger (desktop collapse) */}
      <button className="topbar-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
        <IconMenu />
      </button>

      {/* Logo */}
      <div className="topbar-logo">
        <div className="topbar-logo-icon" aria-hidden="true">
          <IconNoteAI />
        </div>
        <span className="topbar-logo-text">Flow</span>
      </div>

      <div className="topbar-divider" aria-hidden="true" />

      {/* Mode Switcher */}
      <div className="mode-switcher">
        <button
          className={`mode-switcher-btn ${activeMode === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveMode('knowledge')}
        >
          Knowledge
        </button>
        <button
          className={`mode-switcher-btn ${activeMode === 'agent' ? 'active' : ''}`}
          onClick={() => setActiveMode('agent')}
        >
          Agent
        </button>
      </div>

      <div className="topbar-divider" aria-hidden="true" />

      {/* Breadcrumb */}
      <Breadcrumb activeView={activeView} noteTitle={noteTitle} />

      <div className="topbar-spacer" />

      {/* Search / Cmd trigger */}
      <button
        className="topbar-search-trigger"
        onClick={openCmd}
        aria-label="Open command palette"
        id="topbar-cmd-trigger"
      >
        <IconSearch />
        <span style={{ flex: 1, textAlign: 'left' }}>Search or command…</span>
        <div className="topbar-search-kbd">
          <kbd>⌘</kbd><kbd>K</kbd>
        </div>
      </button>

      {/* Right actions */}
      <div className="topbar-actions">
        {/* AI panel toggle */}
        <button
          className={`topbar-btn ${rightPanelOpen ? 'active' : ''}`}
          onClick={toggleRightPanel}
          aria-label="Toggle AI panel"
          id="topbar-ai-toggle"
          title="AI Panel"
        >
          <IconAI />
        </button>

        {/* Theme toggle */}
        <button
          className="topbar-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          id="topbar-theme-toggle"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>

        {/* Settings */}
        <button
          className="topbar-btn"
          onClick={onSettingsOpen}
          aria-label="Settings"
          id="topbar-settings-btn"
          title="Settings"
        >
          <IconSettings />
        </button>

        {/* Sync badge */}
        <SyncBadge state={syncState} />

        {/* User menu */}
        {user && (
          <div
            className="topbar-user"
            title="Sign out"
            onClick={signOut}
            role="button"
            tabIndex={0}
            id="topbar-user"
            onKeyDown={(e) => e.key === 'Enter' && signOut()}
          >
            <div className="topbar-avatar" aria-hidden="true">{initials}</div>
            <span className="topbar-user-email">{user.email}</span>
            <IconLogOut />
          </div>
        )}
      </div>
    </header>
  );
}
