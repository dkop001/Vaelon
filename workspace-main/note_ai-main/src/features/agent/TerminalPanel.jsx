import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function TerminalPanel({ onCommandRun, onOutputCapture }) {
  const [lines, setLines] = useState([
    { type: 'system', text: 'Flow Terminal v1.0 — Real shell commands' },
    { type: 'prompt', text: '' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const executeCommand = async (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setIsRunning(true);

    setLines((prev) => [
      ...prev.slice(0, -1),
      { type: 'command', text: `$ ${trimmed}` },
    ]);

    // Built-in commands
    if (trimmed === 'help') {
      addOutput([
        'Available commands:',
        '  help        Show this help',
        '  clear       Clear terminal',
        '  pwd         Show current directory',
        '  ls          List files',
        '',
        'All other commands are executed via the real shell.',
      ]);
      setIsRunning(false);
      return;
    }

    if (trimmed === 'clear') {
      setLines([{ type: 'prompt', text: '' }]);
      setIsRunning(false);
      return;
    }

    // Execute via Tauri shell API
    try {
      const result = await invoke('run_shell_command', { command: trimmed });
      const output = [];

      if (result.stdout && result.stdout.trim()) {
        output.push(...result.stdout.trim().split('\n'));
      }
      if (result.stderr && result.stderr.trim()) {
        output.push(...result.stderr.trim().split('\n').map(l => `[stderr] ${l}`));
      }

      if (output.length === 0) {
        output.push('(no output)');
      }

      addOutput(output);

      // Capture output for AI context
      if (onOutputCapture) {
        onOutputCapture({
          command: trimmed,
          stdout: result.stdout,
          stderr: result.stderr,
          success: !result.stderr || result.stderr.trim().length === 0,
        });
      }
    } catch (err) {
      addOutput([`Error: ${err}`]);
    } finally {
      setIsRunning(false);
    }
  };

  const addOutput = (output) => {
    setLines((prev) => {
      const newLines = [
        ...prev.slice(0, -1),
        ...output.map((t) => ({ type: 'output', text: t })),
        { type: 'prompt', text: '' },
      ];
      // Cap at 500 lines to prevent memory issues
      return newLines.length > 500 ? newLines.slice(-500) : newLines;
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isRunning) {
      executeCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'prompt', text: '' }]);
    }
  };

  const clearTerminal = () => {
    setLines([{ type: 'prompt', text: '' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="agent-panel-header">
        <span className="agent-panel-title">Terminal</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className="agent-cmd-skip" onClick={clearTerminal} style={{ fontSize: '0.6875rem' }}>
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="agent-terminal"
        onClick={() => inputRef.current?.focus()}
        style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', lineHeight: 1.6 }}
      >
        {lines.map((line, i) => {
          if (line.type === 'prompt') {
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <span style={{ color: 'var(--success)', marginRight: 6, fontWeight: 600 }}>$</span>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isRunning}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--tx-primary)', fontFamily: 'inherit', fontSize: 'inherit',
                    padding: 0, caretColor: 'var(--accent)',
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            );
          }

          const color = {
            system: 'var(--tx-tertiary)',
            command: 'var(--accent)',
            output: 'var(--tx-secondary)',
          }[line.type] || 'var(--tx-primary)';

          return (
            <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {line.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
