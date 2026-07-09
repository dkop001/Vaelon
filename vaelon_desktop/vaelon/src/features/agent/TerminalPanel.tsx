import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTerminalStore } from '../../store/terminalStore';
import { onEvent } from '../../ipc/client';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  
  const { activeSessionId, spawnSession, writeToSession, resizeSession, killSession } = useTerminalStore();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize xterm
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

    // Create session if none active
    let sessionId = activeSessionId;
    
    const initSession = async () => {
      if (!sessionId) {
        try {
          sessionId = await spawnSession();
        } catch (err) {
          term.write(`\r\n\x1b[31mError spawning terminal session: ${err}\x1b[0m\r\n`);
          return;
        }
      }

      // Handle user key inputs
      term.onData((data) => {
        if (sessionId) {
          writeToSession(sessionId, data);
        }
      });

      // Handle PTY output streaming
      const unsubOutput = onEvent<{ id: string; data: string }>(
        'terminal:output',
        (payload) => {
          if (payload.id === sessionId) {
            term.write(payload.data);
          }
        }
      );

      // Handle terminal resize
      const handleResize = () => {
        try {
          fitAddon.fit();
          if (sessionId && term.cols && term.rows) {
            resizeSession(sessionId, term.cols, term.rows);
          }
        } catch {}
      };

      window.addEventListener('resize', handleResize);
      setTimeout(handleResize, 100);

      // Save listener cleanup
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
  }, [activeSessionId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="agent-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <span className="agent-panel-title" style={{ fontWeight: 600, fontSize: '0.875rem' }}>Terminal</span>
        <button
          className="agent-cmd-skip"
          onClick={() => activeSessionId && killSession(activeSessionId)}
          style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-active)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          Reset Session
        </button>
      </div>
      <div
        ref={containerRef}
        style={{ flex: 1, padding: 8, background: '#0c0d12', overflow: 'hidden' }}
      />
    </div>
  );
}
