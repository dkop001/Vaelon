import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { getMode, setMode, saveSettings, getSettings, getOllamaModels, pingOllama } from '../../lib/aiRouter';

const MODES = [
  { value: 'auto',  label: 'Auto',  icon: '⚡', desc: 'Uses Ollama if running, otherwise Groq cloud' },
  { value: 'local', label: 'Local', icon: '💻', desc: 'Ollama only — fully offline, zero cloud' },
  { value: 'cloud', label: 'Cloud', icon: '☁️', desc: 'Groq API — fast, requires internet' },
];

export default function SettingsPanel({ onClose }) {
  const { setAiMode } = useAppStore();
  const [settings, setSettings] = useState(getSettings());
  const [ollamaAvailable, setOllamaAvailable] = useState(null);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [testingOllama, setTestingOllama] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    checkOllama();
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  const handleEsc = (e) => { if (e.key === 'Escape') onClose?.(); };

  const checkOllama = async () => {
    setTestingOllama(true);
    const available = await pingOllama();
    setOllamaAvailable(available);
    if (available) {
      const models = await getOllamaModels();
      setOllamaModels(models);
    }
    setTestingOllama(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setAiMode(settings.mode);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose?.();
    }, 600);
  };

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="settings-panel" role="dialog" aria-label="Settings">
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* ── AI Engine ── */}
          <section className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">🧠</span>
              <div>
                <div className="settings-section-title">AI Engine</div>
                <div className="settings-section-desc">Choose where AI processing happens</div>
              </div>
            </div>

            <div className="mode-grid">
              {MODES.map((opt) => (
                <button
                  key={opt.value}
                  className={`mode-card ${settings.mode === opt.value ? 'active' : ''}`}
                  onClick={() => update('mode', opt.value)}
                >
                  <span className="mode-card-icon">{opt.icon}</span>
                  <span className="mode-card-label">{opt.label}</span>
                  <span className="mode-card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Ollama ── */}
          <section className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">🖥️</span>
              <div>
                <div className="settings-section-title">Ollama (Local AI)</div>
                <div className="settings-section-desc">Run AI models on your machine</div>
              </div>
            </div>

            {/* Status row */}
            <div className="ollama-status">
              <div className="ollama-status-left">
                <span className={`ollama-dot ${ollamaAvailable ? 'online' : ollamaAvailable === false ? 'offline' : 'unknown'}`} />
                <span className="ollama-status-text">
                  {testingOllama ? 'Checking connection...' : ollamaAvailable ? 'Connected' : 'Not running — install from ollama.ai'}
                </span>
              </div>
              <button className="settings-btn-sm" onClick={checkOllama} disabled={testingOllama}>
                {testingOllama ? 'Checking...' : 'Refresh'}
              </button>
            </div>

            {/* Model picker */}
            <div className="settings-field">
              <label className="settings-label">Active Model</label>
              <select
                className="settings-select"
                value={settings.ollamaModel || ''}
                onChange={(e) => update('ollamaModel', e.target.value || null)}
              >
                {ollamaModels.length > 0 ? (
                  ollamaModels.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))
                ) : (
                  <option value="">No models detected — start Ollama first</option>
                )}
              </select>
              <p className="settings-hint">
                Pull more models: <code>ollama pull {'<model>'}</code>
              </p>
            </div>
          </section>

          {/* ── Cloud Fallback ── */}
          <section className="settings-section">
            <div className="settings-section-header">
              <span className="settings-section-icon">☁️</span>
              <div>
                <div className="settings-section-title">Cloud Fallback</div>
                <div className="settings-section-desc">Groq API for when Ollama isn't available</div>
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">Groq API Key</label>
              <input
                type="password"
                className="settings-input"
                placeholder="gsk_..."
                value={settings.groqApiKey || ''}
                onChange={(e) => update('groqApiKey', e.target.value)}
              />
              <p className="settings-hint">
                Free at <a href="https://console.groq.com" target="_blank" rel="noreferrer">console.groq.com</a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="settings-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="settings-btn-primary" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      <style>{`
        .settings-overlay {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

        .settings-panel {
          background: var(--bg-surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); width: 520px; max-width: 94vw;
          max-height: 88vh; display: flex; flex-direction: column;
          box-shadow: var(--shadow-xl); animation: slideUp 0.2s ease;
          overflow: hidden;
        }

        .settings-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--sp-5) var(--sp-6); border-bottom: 1px solid var(--border-subtle);
        }
        .settings-title {
          margin: 0; font-size: var(--text-lg); font-weight: var(--weight-bold);
          color: var(--tx-primary); font-family: var(--font-heading);
        }
        .settings-close {
          width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-sm); border: none; background: transparent;
          color: var(--tx-tertiary); cursor: pointer; transition: var(--t-fast);
        }
        .settings-close:hover { background: var(--bg-hover); color: var(--tx-primary); }

        .settings-body {
          flex: 1; overflow-y: auto; padding: var(--sp-5) var(--sp-6);
          display: flex; flex-direction: column; gap: var(--sp-6);
        }

        .settings-section {
          display: flex; flex-direction: column; gap: var(--sp-4);
        }
        .settings-section-header {
          display: flex; align-items: flex-start; gap: var(--sp-3);
        }
        .settings-section-icon { font-size: 1.125rem; margin-top: 1px; }
        .settings-section-title {
          font-size: var(--text-md); font-weight: var(--weight-semibold);
          color: var(--tx-primary); line-height: 1.3;
        }
        .settings-section-desc {
          font-size: var(--text-sm); color: var(--tx-tertiary); margin-top: 1px;
        }

        .mode-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3);
        }
        .mode-card {
          display: flex; flex-direction: column; align-items: center;
          gap: var(--sp-2); padding: var(--sp-4) var(--sp-3);
          border-radius: var(--radius-lg); border: 1.5px solid var(--border);
          background: var(--bg-elevated); cursor: pointer;
          transition: var(--t-base); text-align: center;
        }
        .mode-card:hover { border-color: var(--border-strong); background: var(--bg-overlay); }
        .mode-card.active {
          border-color: var(--accent); background: var(--accent-muted);
          box-shadow: 0 0 0 1px var(--accent-border);
        }
        .mode-card-icon { font-size: 1.25rem; }
        .mode-card-label {
          font-size: var(--text-sm); font-weight: var(--weight-semibold);
          color: var(--tx-primary);
        }
        .mode-card.active .mode-card-label { color: var(--accent); }
        .mode-card-desc {
          font-size: var(--text-xs); color: var(--tx-tertiary);
          line-height: 1.4;
        }

        .ollama-status {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--sp-3) var(--sp-4); border-radius: var(--radius-md);
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
        }
        .ollama-status-left { display: flex; align-items: center; gap: var(--sp-3); }
        .ollama-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .ollama-dot.online { background: var(--success); box-shadow: 0 0 6px var(--success); }
        .ollama-dot.offline { background: var(--danger); }
        .ollama-dot.unknown { background: var(--warning); }
        .ollama-status-text { font-size: var(--text-sm); color: var(--tx-secondary); }

        .settings-field { display: flex; flex-direction: column; gap: var(--sp-2); }
        .settings-label {
          font-size: var(--text-sm); font-weight: var(--weight-medium);
          color: var(--tx-secondary);
        }
        .settings-input, .settings-select {
          width: 100%; padding: var(--sp-3) var(--sp-4);
          border-radius: var(--radius-md); border: 1px solid var(--border);
          background: var(--bg-elevated); color: var(--tx-primary);
          font-size: var(--text-sm); font-family: var(--font-sans);
          transition: var(--t-fast); box-sizing: border-box;
        }
        .settings-input:focus, .settings-select:focus {
          outline: none; border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-muted);
        }
        .settings-input::placeholder { color: var(--tx-disabled); }
        .settings-select { cursor: pointer; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center;
          padding-right: 32px;
        }
        .settings-hint {
          font-size: var(--text-xs); color: var(--tx-tertiary); margin: 0;
          line-height: 1.5;
        }
        .settings-hint code {
          font-family: var(--font-mono); background: var(--bg-overlay);
          padding: 1px 5px; border-radius: var(--radius-xs); font-size: 0.6875rem;
        }
        .settings-hint a { color: var(--accent); text-decoration: none; }
        .settings-hint a:hover { text-decoration: underline; }

        .settings-footer {
          display: flex; gap: var(--sp-3); justify-content: flex-end;
          padding: var(--sp-4) var(--sp-6); border-top: 1px solid var(--border-subtle);
          background: var(--bg-base);
        }
        .settings-btn-secondary {
          padding: var(--sp-3) var(--sp-5); border-radius: var(--radius-md);
          border: 1px solid var(--border); background: var(--bg-elevated);
          color: var(--tx-secondary); font-weight: var(--weight-medium);
          font-size: var(--text-sm); cursor: pointer; transition: var(--t-fast);
          font-family: var(--font-sans);
        }
        .settings-btn-secondary:hover { background: var(--bg-hover); color: var(--tx-primary); }
        .settings-btn-primary {
          padding: var(--sp-3) var(--sp-5); border-radius: var(--radius-md);
          border: none; background: var(--accent); color: #fff;
          font-weight: var(--weight-semibold); font-size: var(--text-sm);
          cursor: pointer; transition: var(--t-fast); font-family: var(--font-sans);
          min-width: 110px; text-align: center;
        }
        .settings-btn-primary:hover { background: var(--accent-hover); }
        .settings-btn-sm {
          padding: var(--sp-2) var(--sp-3); border-radius: var(--radius-sm);
          border: 1px solid var(--border); background: var(--bg-surface);
          color: var(--tx-secondary); font-size: var(--text-xs);
          font-weight: var(--weight-medium); cursor: pointer; transition: var(--t-fast);
          font-family: var(--font-sans);
        }
        .settings-btn-sm:hover { background: var(--bg-hover); color: var(--tx-primary); }
        .settings-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
