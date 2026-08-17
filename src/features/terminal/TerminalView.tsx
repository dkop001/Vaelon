import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTerminalStore } from '../../store/terminalStore';
import { useAppStore } from '../../store/appStore';
import { onEvent } from '../../ipc/client';
import '@xterm/xterm/css/xterm.css';

export default function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const {
    activeSessionId,
    sessions,
    spawnSession,
    writeToSession,
    resizeSession,
    killSession,
    setActiveSession,
  } = useTerminalStore();

  const { activeProjectPath } = useAppStore();

  const [localSessionId, setLocalSessionId] = useState<string | null>(activeSessionId);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0c0d12',
        foreground: '#f8f8f2',
        cursor: '#f8f8f0',
        selectionBackground: '#44475a',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
      },
      fontFamily: 'Fira Code, Consolas, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let currentSessionId = localSessionId;

    const initSession = async () => {
      if (!currentSessionId) {
        try {
          currentSessionId = await spawnSession(undefined, activeProjectPath || undefined);
          setLocalSessionId(currentSessionId);
        } catch (err) {
          term.write(`\r\n\x1b[31mError spawning terminal session: ${err}\x1b[0m\r\n`);
          return;
        }
      }

      term.onData((data) => {
        if (currentSessionId) {
          writeToSession(currentSessionId, data);
        }
      });

      const unsubOutput = onEvent<{ id: string; data: string }>(
        'terminal:output',
        (payload) => {
          if (payload.id === currentSessionId) {
            term.write(payload.data);
          }
        }
      );

      const handleResize = () => {
        try {
          fitAddon.fit();
          if (currentSessionId && term.cols && term.rows) {
            resizeSession(currentSessionId, term.cols, term.rows);
          }
        } catch {}
      };

      window.addEventListener('resize', handleResize);
      setTimeout(handleResize, 100);

      (term as any)._unsubOutput = unsubOutput;
      (term as any)._handleResize = handleResize;
    };

    initSession();

    return () => {
      if (termRef.current) {
        const t = termRef.current as any;
        if (t._unsubOutput) t._unsubOutput();
        if (t._handleResize) window.removeEventListener('resize', t._handleResize);
        termRef.current.dispose();
      }
    };
  }, [localSessionId, activeProjectPath, spawnSession, writeToSession, resizeSession]);

  useEffect(() => {
    if (activeSessionId !== localSessionId) {
      setLocalSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  const handleNewSession = async () => {
    try {
      const newId = await spawnSession(undefined, activeProjectPath || undefined);
      setLocalSessionId(newId);
    } catch (err) {
      termRef.current?.write(`\r\n\x1b[31mError spawning session: ${err}\x1b[0m\r\n`);
    }
  };

  const handleKillSession = async (id: string) => {
    await killSession(id);
    if (localSessionId === id) {
      const remainingIds = Object.keys(sessions).filter(s => s !== id);
      if (remainingIds.length > 0) {
        setLocalSessionId(remainingIds[0]);
      } else {
        setLocalSessionId(null);
      }
    }
  };

  const handleSwitchSession = (id: string) => {
    setLocalSessionId(id);
    setActiveSession(id);
  };

  return (
    <div className="terminal-view">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <div className="terminal-actions">
          {Object.keys(sessions).length > 0 && (
            <select
              className="terminal-session-select"
              value={localSessionId || ''}
              onChange={(e) => e.target.value && handleSwitchSession(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--tx-primary)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {Object.entries(sessions).map(([id, session]) => (
                <option key={id} value={id}>
                  {session.isAlive ? '●' : '○'} Session {id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleNewSession}
            title="New Session"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New
          </button>
          {localSessionId && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => handleKillSession(localSessionId)}
              title="Kill Session"
              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 3.5h9M5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 6v4M8.5 6v4M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Kill
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}