import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentStore, AgentTask, AgentObservation } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useNoteStore } from '../../store/noteStore';
import TerminalPanel from './TerminalPanel';

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  send: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 1.5 1.5 7l5.5 1.5M14 1.5 9.5 14.5l-2.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  stop: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  spinner: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22 12" strokeLinecap="round"/>
    </svg>
  ),
  check: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7l4 4 6-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  fail: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3l8 8M11 3 3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  run: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 2.5l8 5-8 5V2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  ),
  block: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  terminal: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3.5 5L6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentTask['status'] }) {
  const cfg = {
    pending:   { color: 'var(--tx-tertiary)', icon: <span>·</span> },
    running:   { color: 'var(--accent)',       icon: <Ico.spinner /> },
    completed: { color: 'var(--success)',      icon: <Ico.check /> },
    failed:    { color: 'var(--danger)',       icon: <Ico.fail /> },
    blocked:   { color: 'var(--warning)',      icon: <Ico.block /> },
  };
  const { color, icon } = cfg[status];
  return (
    <span style={{ color, display: 'flex', alignItems: 'center', flexShrink: 0, width: 18 }}>
      {icon}
    </span>
  );
}

// ── Task list ─────────────────────────────────────────────────────────────────
function TaskList({ tasks }: { tasks: AgentTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <div className="agent-task-list">
      {tasks.map(task => (
        <div key={task.id} className={`agent-task-item agent-task-${task.status}`}>
          <StatusBadge status={task.status} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="agent-task-desc">{task.description}</div>
            {task.command && (
              <div className="agent-task-cmd">
                <Ico.terminal /> <code>{task.command}</code>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Observation log ───────────────────────────────────────────────────────────
function ObservationLog({ observations }: { observations: AgentObservation[] }) {
  if (observations.length === 0) return null;
  return (
    <div className="agent-obs-list">
      {observations.slice(-5).map((obs, i) => (
        <div key={i} className={`agent-obs-item ${obs.success ? 'success' : 'fail'}`}>
          {obs.success ? <Ico.check /> : <Ico.fail />}
          <span className="agent-obs-text">{obs.text}</span>
          <span className="agent-obs-time">{obs.timestamp}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ created, modified, actions, errors }: { created: number; modified: number; actions: number; errors: number }) {
  return (
    <div className="agent-stats-bar">
      <span className="agent-stat"><span style={{ color: 'var(--success)' }}>+{created}</span> created</span>
      <span className="agent-stat"><span style={{ color: 'var(--accent)' }}>~{modified}</span> modified</span>
      <span className="agent-stat"><span style={{ color: 'var(--tx-secondary)' }}>{actions}</span> actions</span>
      {errors > 0 && <span className="agent-stat"><span style={{ color: 'var(--danger)' }}>⚠ {errors}</span> errors</span>}
    </div>
  );
}

// ── Main AgentMode ────────────────────────────────────────────────────────────
export default function AgentMode() {
  const {
    status, goal, tasks, observations, runId,
    filesCreatedCount, filesModifiedCount, actionsCompletedCount, errorCount,
    blockedActionId, blockedReason,
    startAgent, stopAgent, approveAction, clearState,
  } = useAgentStore();

  const { activeWorkspaceId } = useWorkspaceStore();
  const { notes, activeNoteId } = useNoteStore();
  const activeNote = notes.find(n => n.id === activeNoteId);

  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'terminal'>('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = status === 'running' || status === 'planning';
  const isBlocked = status === 'blocked';
  const isDone = status === 'completed' || status === 'failed';

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
  };

  const handleStart = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;
    const workspacePath = activeWorkspaceId ?? '.';
    setInput('');
    await startAgent(text, workspacePath);
  }, [input, isRunning, activeWorkspaceId, startAgent]);

  const handleStop = useCallback(async () => {
    await stopAgent();
  }, [stopAgent]);

  const handleApprove = useCallback(async () => {
    await approveAction();
  }, [approveAction]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleStart();
    }
  };

  return (
    <div className="agent-mode-shell">
      {/* ── Left: Chat/Task Panel ── */}
      <div className="agent-left-panel">
        {/* Header */}
        <div className="agent-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`agent-status-dot ${status}`} />
            <span className="agent-panel-title">Agent</span>
            {goal && <span className="agent-goal-label">{goal.slice(0, 40)}{goal.length > 40 ? '…' : ''}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isDone && (
              <button className="agent-cmd-btn" onClick={clearState}>
                New Task
              </button>
            )}
            {(isRunning || isBlocked) && (
              <button className="agent-cmd-stop" onClick={handleStop}>
                <Ico.stop /> Stop
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="agent-tab-bar">
          <button className={`agent-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Tasks</button>
          <button className={`agent-tab ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
            <Ico.terminal /> Terminal
          </button>
        </div>

        {/* Content */}
        <div className="agent-panel-body">
          {activeTab === 'chat' ? (
            <>
              {/* Status area */}
              {status === 'idle' && tasks.length === 0 && (
                <div className="agent-empty">
                  <div className="agent-empty-icon">⚡</div>
                  <div className="agent-empty-title">Agent Mode</div>
                  <div className="agent-empty-desc">
                    Describe a goal and the agent will plan and execute it autonomously using your workspace.
                  </div>
                  {activeNote && (
                    <div className="agent-context-badge">
                      📄 Context: {activeNote.title || 'Untitled'}
                    </div>
                  )}
                </div>
              )}

              {status === 'planning' && (
                <div className="agent-status-row">
                  <Ico.spinner /> <span>Planning…</span>
                </div>
              )}

              {/* Task list */}
              <TaskList tasks={tasks} />

              {/* Blocked approval */}
              {isBlocked && blockedReason && (
                <div className="agent-blocked-card">
                  <div className="agent-blocked-header">
                    <Ico.block /> Approval Required
                  </div>
                  <div className="agent-blocked-reason">{blockedReason}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="agent-approve-btn" onClick={handleApprove}>
                      ✓ Approve
                    </button>
                    <button className="agent-cmd-stop" onClick={handleStop} style={{ flex: 1 }}>
                      ✕ Deny
                    </button>
                  </div>
                </div>
              )}

              {/* Observation log */}
              <ObservationLog observations={observations} />

              {/* Completed stats */}
              {status === 'completed' && (
                <div className="agent-completed-card">
                  <div className="agent-completed-title">✓ Goal Completed</div>
                  <StatsBar
                    created={filesCreatedCount}
                    modified={filesModifiedCount}
                    actions={actionsCompletedCount}
                    errors={errorCount}
                  />
                </div>
              )}

              {status === 'failed' && (
                <div className="agent-failed-card">
                  <div className="agent-failed-title">✕ Agent Failed</div>
                  <div className="agent-failed-desc">The agent encountered an unrecoverable error. Check the terminal for details.</div>
                </div>
              )}
            </>
          ) : (
            <TerminalPanel />
          )}
        </div>

        {/* Input */}
        <div className="agent-input-area">
          <textarea
            ref={textareaRef}
            className="agent-input"
            placeholder={isRunning ? 'Agent is running…' : 'Describe a goal (Ctrl+Enter to start)…'}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            rows={2}
            aria-label="Agent goal input"
          />
          <button
            className={`agent-send-btn ${isRunning ? 'running' : ''}`}
            onClick={isRunning ? handleStop : handleStart}
            disabled={!isRunning && !input.trim()}
            aria-label={isRunning ? 'Stop agent' : 'Start agent'}
          >
            {isRunning ? <Ico.stop /> : <Ico.send />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .agent-mode-shell {
          display: flex; height: 100%; width: 100%; overflow: hidden;
          background: var(--bg-base);
        }

        .agent-left-panel {
          display: flex; flex-direction: column; flex: 1; height: 100%;
          border-right: 1px solid var(--border);
          min-width: 0;
        }

        .agent-panel-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .agent-panel-title { font-weight: 700; font-size: 0.875rem; color: var(--tx-primary); }
        .agent-goal-label {
          font-size: 0.75rem; color: var(--tx-tertiary);
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          padding: 2px 8px; border-radius: 10px; max-width: 200px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .agent-status-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--tx-disabled);
        }
        .agent-status-dot.running { background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 1.5s ease-in-out infinite; }
        .agent-status-dot.planning { background: var(--warning); animation: pulse 1.5s ease-in-out infinite; }
        .agent-status-dot.completed { background: var(--success); }
        .agent-status-dot.failed { background: var(--danger); }
        .agent-status-dot.blocked { background: var(--warning); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .agent-tab-bar {
          display: flex; border-bottom: 1px solid var(--border);
          background: var(--bg-secondary); flex-shrink: 0;
        }
        .agent-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 16px; font-size: 0.8125rem; font-weight: 500;
          color: var(--tx-tertiary); cursor: pointer;
          border: none; background: transparent;
          border-bottom: 2px solid transparent; transition: all 0.15s;
        }
        .agent-tab:hover { color: var(--tx-primary); }
        .agent-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

        .agent-panel-body {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
        }

        .agent-empty {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 40px 24px; gap: 8px;
        }
        .agent-empty-icon { font-size: 32px; margin-bottom: 8px; }
        .agent-empty-title { font-size: 1rem; font-weight: 700; color: var(--tx-primary); }
        .agent-empty-desc { font-size: 0.8125rem; color: var(--tx-tertiary); line-height: 1.6; max-width: 280px; }
        .agent-context-badge {
          font-size: 0.75rem; color: var(--accent);
          background: var(--accent-muted); border: 1px solid var(--accent-border);
          padding: 4px 12px; border-radius: 20px; margin-top: 8px;
        }

        .agent-status-row {
          display: flex; align-items: center; gap: 8px;
          color: var(--tx-secondary); font-size: 0.875rem;
          padding: 8px 12px;
          background: var(--bg-elevated); border-radius: 8px;
          border: 1px solid var(--border-subtle);
        }

        .agent-task-list { display: flex; flex-direction: column; gap: 6px; }
        .agent-task-item {
          display: flex; align-items: flex-start; gap: 8px;
          padding: 8px 12px; border-radius: 8px;
          background: var(--bg-elevated); border: 1px solid var(--border-subtle);
          transition: all 0.15s;
        }
        .agent-task-item.agent-task-running { border-color: var(--accent-border); background: var(--accent-muted); }
        .agent-task-item.agent-task-completed { border-color: hsla(142,71%,45%,.2); }
        .agent-task-item.agent-task-failed { border-color: hsla(0,72%,55%,.2); }
        .agent-task-item.agent-task-blocked { border-color: hsla(38,92%,50%,.3); }
        .agent-task-desc { font-size: 0.8125rem; color: var(--tx-primary); line-height: 1.4; }
        .agent-task-cmd {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.75rem; color: var(--tx-tertiary); margin-top: 2px;
        }
        .agent-task-cmd code {
          font-family: var(--font-mono); background: var(--bg-overlay);
          padding: 1px 4px; border-radius: 3px;
        }

        .agent-obs-list { display: flex; flex-direction: column; gap: 4px; }
        .agent-obs-item {
          display: flex; align-items: flex-start; gap: 6px;
          font-size: 0.75rem; line-height: 1.4; padding: 4px 8px;
          border-radius: 6px;
        }
        .agent-obs-item.success { color: var(--success); }
        .agent-obs-item.fail { color: var(--danger); }
        .agent-obs-text { flex: 1; color: var(--tx-secondary); }
        .agent-obs-time { color: var(--tx-disabled); font-size: 0.6875rem; flex-shrink: 0; }

        .agent-blocked-card {
          padding: 16px; border-radius: 10px;
          background: hsla(38,92%,50%,.08); border: 1px solid hsla(38,92%,50%,.3);
          display: flex; flex-direction: column; gap: 10px;
        }
        .agent-blocked-header {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.875rem; font-weight: 600; color: var(--warning);
        }
        .agent-blocked-reason { font-size: 0.8125rem; color: var(--tx-secondary); line-height: 1.5; }
        .agent-approve-btn {
          flex: 1; padding: 8px; border-radius: 6px; border: none;
          background: var(--success); color: white; font-weight: 600;
          font-size: 0.8125rem; cursor: pointer; transition: all 0.15s;
        }
        .agent-approve-btn:hover { filter: brightness(1.1); }

        .agent-completed-card {
          padding: 16px; border-radius: 10px;
          background: hsla(142,71%,45%,.08); border: 1px solid hsla(142,71%,45%,.2);
          display: flex; flex-direction: column; gap: 8px;
        }
        .agent-completed-title { font-weight: 700; color: var(--success); font-size: 0.875rem; }

        .agent-failed-card {
          padding: 16px; border-radius: 10px;
          background: hsla(0,72%,55%,.08); border: 1px solid hsla(0,72%,55%,.2);
          display: flex; flex-direction: column; gap: 4px;
        }
        .agent-failed-title { font-weight: 700; color: var(--danger); font-size: 0.875rem; }
        .agent-failed-desc { font-size: 0.8125rem; color: var(--tx-secondary); line-height: 1.5; }

        .agent-stats-bar {
          display: flex; flex-wrap: wrap; gap: 12px;
        }
        .agent-stat { font-size: 0.8125rem; color: var(--tx-tertiary); display: flex; gap: 4px; }

        .agent-input-area {
          display: flex; align-items: flex-end; gap: 8px;
          padding: 12px 16px; border-top: 1px solid var(--border);
          background: var(--bg-secondary); flex-shrink: 0;
        }
        .agent-input {
          flex: 1; resize: none; padding: 10px 14px;
          border-radius: 10px; border: 1px solid var(--border);
          background: var(--bg-elevated); color: var(--tx-primary);
          font-size: 0.875rem; font-family: var(--font-sans);
          line-height: 1.5; transition: border-color 0.15s;
          min-height: 44px;
        }
        .agent-input:focus { outline: none; border-color: var(--accent); }
        .agent-input::placeholder { color: var(--tx-disabled); }
        .agent-input:disabled { opacity: 0.5; cursor: not-allowed; }

        .agent-send-btn {
          width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border: none; background: var(--accent); color: white;
          cursor: pointer; transition: all 0.15s;
        }
        .agent-send-btn:hover:not(:disabled) { background: var(--accent-hover); }
        .agent-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .agent-send-btn.running { background: var(--danger); }

        .agent-cmd-btn {
          padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border);
          background: var(--bg-elevated); color: var(--tx-secondary);
          font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .agent-cmd-btn:hover { background: var(--bg-hover); color: var(--tx-primary); }
        .agent-cmd-stop {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 6px;
          border: 1px solid hsla(0,72%,55%,.3); background: hsla(0,72%,55%,.1);
          color: var(--danger); font-size: 0.75rem; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .agent-cmd-stop:hover { background: hsla(0,72%,55%,.2); }
      `}</style>
    </div>
  );
}
