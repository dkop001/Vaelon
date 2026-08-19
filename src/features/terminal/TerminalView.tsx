import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTerminalStore } from '../../store/terminalStore';
import { useAppStore } from '../../store/appStore';
import '@xterm/xterm/css/xterm.css';

export default function TerminalView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const outputIndexRef = useRef(0);

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

  // Initialize xterm once
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
    
    const container = containerRef.current;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      const observer = new ResizeObserver(() => {
        if (container.offsetWidth > 0 && container.offsetHeight > 0) {
          observer.disconnect();
          term.open(container);
          fitAddon.fit();
        }
      });
      observer.observe(container);
    } else {
      term.open(container);
      fitAddon.fit();
    }

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    mountedRef.current = true;
    outputIndexRef.current = 0;

    // Handle input
    term.onData((data) => {
      const sid = currentSessionIdRef.current;
      if (sid && mountedRef.current) {
        writeToSession(sid, data);
      }
    });

    const handleResize = () => {
      if (!mountedRef.current) return;
      try {
        fitAddon.fit();
        const sid = currentSessionIdRef.current;
        if (sid && term.cols && term.rows) {
          resizeSession(sid, term.cols, term.rows);
        }
      } catch {}
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    (term as any)._handleResize = handleResize;

    return () => {
      mountedRef.current = false;
      if (termRef.current) {
        const t = termRef.current as any;
        if (t._handleResize) window.removeEventListener('resize', t._handleResize);
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [writeToSession, resizeSession]);

  // Sync session when activeSessionId changes
  useEffect(() => {
    if (activeSessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = activeSessionId;
      outputIndexRef.current = 0; // Reset output index for new session
    }
  }, [activeSessionId]);

  // Write new output from store to terminal
  useEffect(() => {
    if (!mountedRef.current || !termRef.current) return;
    
    const session = sessions[currentSessionIdRef.current];
    if (!session) return;
    
    const fullOutput = session.output;
    if (fullOutput.length > outputIndexRef.current) {
      const newOutput = fullOutput.slice(outputIndexRef.current);
      outputIndexRef.current = fullOutput.length;
      termRef.current.write(newOutput);
    }
  }, [sessions, activeSessionId]);

  // Auto-spawn session on mount or project path change
  useEffect(() => {
    let cancelled = false;
    
    const ensureSession = async () => {
      if (cancelled) return;
      if (!currentSessionIdRef.current && activeProjectPath) {
        try {
          const id = await spawnSession(undefined, activeProjectPath);
          if (cancelled) return;
          currentSessionIdRef.current = id;
          outputIndexRef.current = 0;
        } catch (err) {
          if (!cancelled && termRef.current) {
            termRef.current.write(`\r\n\x1b[31mError spawning terminal: ${err}\x1b[0m\r\n`);
          }
        }
      }
    };

    ensureSession();
    return () => { cancelled = true; };
  }, [activeProjectPath, spawnSession]);

  const handleNewSession = useCallback(async () => {
    try {
      const newId = await spawnSession(undefined, activeProjectPath || undefined);
      currentSessionIdRef.current = newId;
      outputIndexRef.current = 0;
    } catch (err) {
      termRef.current?.write(`\r\n\x1b[31mError spawning session: ${err}\x1b[0m\r\n`);
    }
  }, [spawnSession, activeProjectPath]);

  const handleKillSession = useCallback(async (id: string) => {
    await killSession(id);
    if (currentSessionIdRef.current === id) {
      const remainingIds = Object.keys(sessions).filter(s => s !== id);
      currentSessionIdRef.current = remainingIds.length > 0 ? remainingIds[0] : null;
      outputIndexRef.current = 0;
    }
  }, [killSession, sessions]);

  const handleSwitchSession = useCallback((id: string) => {
    currentSessionIdRef.current = id;
    outputIndexRef.current = 0;
    setActiveSession(id);
  }, [setActiveSession]);

  return (
    <div className="terminal-view">
      <div className="terminal-header">
        <span className="terminal-title">Terminal</span>
        <div className="terminal-actions">
          {Object.keys(sessions).length > 0 && (
            <select
              className="terminal-session-select"
              value={currentSessionIdRef.current || ''}
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
          {currentSessionIdRef.current && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => handleKillSession(currentSessionIdRef.current!)}
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