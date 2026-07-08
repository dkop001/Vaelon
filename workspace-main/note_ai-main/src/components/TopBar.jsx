import { useEffect, useState } from 'react';
import { Moon, Sun, Sparkles, Search, Menu, X, User, LogOut, PanelRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Sparkles },
  { id: 'notes', label: 'Notes', icon: null },
  { id: 'ai', label: 'AI', icon: null },
  { id: 'study', label: 'Study', icon: null },
  { id: 'graph', label: 'Graph', icon: null },
];

export default function TopBar({ currentView, onViewChange, onAuthClick, onToggleSidebar, sidebarOpen, onToggleRightPanel, rightPanelOpen }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <div className="topbar">
      <div className="topbar-logo">
        <button className="topbar-btn topbar-mobile-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <div className="topbar-logo-icon">
          <Sparkles size={15} color="white" />
        </div>
        <span className="topbar-logo-text">Note AI</span>
      </div>

      <nav className="topbar-nav">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`topbar-nav-btn${currentView === id ? ' active' : ''}`}
            onClick={() => onViewChange(id)}
          >
            {Icon && <Icon size={15} />}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-actions">
        <button className="topbar-btn" onClick={onToggleRightPanel} aria-label="Toggle right panel" title="Toggle AI Panel">
          <PanelRight size={16} />
        </button>
        <button className="topbar-btn" aria-label="Search" title="Search (Ctrl+K)">
          <Search size={16} />
        </button>
        <button className="topbar-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '2px 8px 2px 4px', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)', color: 'var(--text-secondary)',
            }}>
              <User size={14} />
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </span>
            </div>
            <button className="topbar-btn" onClick={() => signOut()} title="Sign out" style={{ color: 'hsl(0,84%,60%)' }}>
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={onAuthClick} style={{ padding: '4px 12px', minHeight: '30px', fontSize: 'var(--text-sm)' }}>
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}
