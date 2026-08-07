import React, { useEffect, useState } from 'react';
import { Moon, Sun, Sparkles, LogOut, User, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { id: 'home',       label: 'Home' },
  { id: 'features',   label: 'Features' },
  { id: 'howItWorks', label: 'How it works' },
];

const Header = ({ currentView, onAuthClick, onGoHome, onGoFeatures, onGoHowItWorks, onGetStarted }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 640) setMobileMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const NAV_HANDLERS = {
    home:       onGoHome,
    features:   onGoFeatures,
    howItWorks: onGoHowItWorks,
  };

  const handleNavClick = (id) => {
    NAV_HANDLERS[id]?.();
    setMobileMenuOpen(false);
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-primary)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div className="header-inner" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.25rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        height: '60px',
        gap: '0.5rem',
      }}>

        {/* ── Logo ─────────────────────────────────────── */}
        <button
          onClick={onGoHome}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0.25rem', borderRadius: 'var(--radius-md)',
            flexShrink: 0, minHeight: 'auto', minWidth: 'auto',
          }}
          aria-label="NoteAI Home"
        >
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            padding: '0.375rem',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px hsla(262,80%,60%,0.35)',
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <span style={{
            fontSize: '1.1875rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, var(--text-primary), var(--accent-primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Note AI</span>
        </button>

        {/* ── Desktop nav (centre) ─────────────────────── */}
        <nav className="header-desktop-actions" style={{
          display: 'none', alignItems: 'center',
          gap: '0.125rem', flex: 1, justifyContent: 'center',
        }}>
          {NAV_ITEMS.map(({ id, label }) => {
            const active = currentView === id ||
              (id === 'home' && (currentView === 'quiz'));
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id)}
                style={{
                  position: 'relative',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'none', border: 'none',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '0.9375rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  minHeight: '44px', minWidth: 'auto',
                }}
                onMouseOver={e => !active && (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseOut={e => !active && (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {label}
                {active && (
                  <span style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '20px',
                    height: '2.5px',
                    borderRadius: '2px',
                    background: 'var(--accent-primary)',
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Desktop right actions ────────────────────── */}
        <div className="header-desktop-actions" style={{
          display: 'none', alignItems: 'center',
          gap: '0.5rem', flexShrink: 0,
        }}>
          <button
            onClick={toggleTheme}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', transition: 'var(--transition)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '36px', minWidth: '36px',
            }}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '0.8125rem', color: 'var(--text-secondary)',
              }}>
                <User size={13} />
                <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.email}
                </span>
              </div>
              <button
                onClick={() => signOut()}
                style={{
                  padding: '0.45rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  color: 'hsl(0,84%,60%)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.875rem', fontWeight: 600,
                  border: '1px solid hsla(0,84%,60%,0.2)',
                  background: 'hsla(0,84%,60%,0.06)',
                  minHeight: '36px', minWidth: 'auto',
                }}
              >
                <LogOut size={15} />Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={onAuthClick}
                style={{
                  padding: '0.45rem 0.875rem', borderRadius: 'var(--radius-md)',
                  background: 'none', border: 'none',
                  color: 'var(--text-primary)', fontSize: '0.9375rem',
                  fontWeight: 500, cursor: 'pointer', transition: 'color 0.2s',
                  minHeight: '44px', minWidth: 'auto',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--accent-primary)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-primary)'}
              >
                Log in
              </button>
              <button
                onClick={onGetStarted}
                className="btn-primary"
                style={{ padding: '0.5rem 1.125rem', minHeight: '38px', fontSize: '0.9375rem', fontWeight: 700 }}
              >
                Get started free
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile right (theme + burger) ─────────────── */}
        <div className="header-mobile-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            onClick={toggleTheme}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ──────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="header-mobile-menu" style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          padding: '0.875rem 1rem calc(0.875rem + env(safe-area-inset-bottom))',
        }}>
          {/* Nav links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {NAV_ITEMS.map(({ id, label }) => {
              const active = currentView === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNavClick(id)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: active ? 'hsla(262,80%,60%,0.08)' : 'var(--bg-secondary)',
                    border: active ? '1px solid hsla(262,80%,60%,0.25)' : '1px solid var(--border-color)',
                    color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
                    fontSize: '0.9375rem', fontWeight: active ? 700 : 500,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Auth section */}
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                fontSize: '0.875rem', color: 'var(--text-secondary)',
              }}>
                <User size={15} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {user.email}
                </span>
              </div>
              <button
                onClick={() => { signOut(); setMobileMenuOpen(false); }}
                style={{
                  width: '100%', padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  color: 'hsl(0,84%,60%)',
                  border: '1px solid hsla(0,84%,60%,0.2)',
                  backgroundColor: 'hsla(0,84%,60%,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', fontSize: '0.9375rem', fontWeight: 600,
                }}
              >
                <LogOut size={18} />Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <button
                onClick={() => { onAuthClick(); setMobileMenuOpen(false); }}
                style={{
                  width: '100%', padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.9375rem',
                  fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                Log in
              </button>
              <button
                onClick={() => { onGetStarted(); setMobileMenuOpen(false); }}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
              >
                Get started free
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .header-mobile-menu { box-shadow: var(--shadow-lg); }
        @media (min-width: 640px) {
          .header-desktop-actions { display: flex !important; }
          .header-mobile-actions  { display: none !important; }
          .header-mobile-menu     { display: none !important; }
        }
        @media (max-width: 639px) {
          .header-desktop-actions { display: none !important; }
          .header-inner           { padding: 0 1rem !important; }
        }
      `}</style>
    </header>
  );
};

export default Header;
