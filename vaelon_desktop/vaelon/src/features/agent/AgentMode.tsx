import { useState, useRef, useCallback } from 'react';
import { useAgentStore, AgentTask, AgentObservation } from '../../store/agentStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useNoteStore } from '../../store/noteStore';
import { Icons } from '../../lib/icons';
import TerminalPanel from './TerminalPanel';

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: AgentTask['status'] }) {
  const cfg = {
    pending:   { color: 'var(--tx-tertiary)', icon: <span>·</span> },
    running:   { color: 'var(--accent)',       icon: <Icons.Spinner className="animate-spin" /> },
    completed: { color: 'var(--success)',      icon: <Icons.Check /> },
    failed:    { color: 'var(--danger)',       icon: <Icons.Close /> },
    blocked:   { color: 'var(--warning)',      icon: <Icons.Alert /> },
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
                <Icons.Terminal /> <code>{task.command}</code>
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
          {obs.success ? <Icons.Check /> : <Icons.Close />}
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
    status, goal, tasks, observations,
    filesCreatedCount, filesModifiedCount, actionsCompletedCount, errorCount,
    blockedReason,
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
                <Icons.Stop /> Stop
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="agent-tab-bar">
          <button className={`agent-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Tasks</button>
          <button className={`agent-tab ${activeTab === 'terminal' ? 'active' : ''}`} onClick={() => setActiveTab('terminal')}>
            <Icons.Terminal /> Terminal
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
                  <Icons.Spinner className="animate-spin" /> <span>Planning…</span>
                </div>
              )}

              {/* Task list */}
              <TaskList tasks={tasks} />

              {/* Blocked approval */}
              {isBlocked && blockedReason && (
                <div className="agent-blocked-card">
                  <div className="agent-blocked-header">
                    <Icons.Alert /> Approval Required
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
            {isRunning ? <Icons.Stop /> : <Icons.Send />}
          </button>
        </div>
      </div>


    </div>
  );
}
