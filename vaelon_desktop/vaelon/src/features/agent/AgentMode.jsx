import { useState, useRef, useEffect, useCallback } from 'react';
import { useNoteStore } from '../../store/noteStore';
import { chat as aiChat } from '../../lib/aiRouter';
import { generatePlan, executePlan, stopAgent, acknowledgeCheckpoint } from '../../lib/agent/agentRunner';
import { EventStream, AgentEventTypes } from '../../lib/agent/EventStream';
import vectorStore from '../../lib/rag/vectorStore';
import TerminalPanel from './TerminalPanel';
import StepChecklist from './StepChecklist';
import StepCheckpoint from './StepCheckpoint';
import SourcesPanel from './SourcesPanel';

export default function AgentMode() {
  const { notes, activeNoteId } = useNoteStore();
  const activeNote = notes.find((n) => n.id === activeNoteId);

  // ── Core state ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [ragIndexed, setRagIndexed] = useState(false);
  const [embeddedCount, setEmbeddedCount] = useState(0);

  // ── Agent state (driven by EventStream) ───────────────────────────────
  const [agentMode, setAgentMode] = useState('chat'); // 'chat' | 'planning' | 'checkpoint' | 'running'
  const [currentPlan, setCurrentPlan] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [lastRAGSources, setLastRAGSources] = useState([]);
  const [terminalOutput, setTerminalOutput] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const streamRef = useRef(null);
  const unsubRef = useRef(null);

  // ── Cleanup on unmount (Bug #36 fix) ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.destroy?.();
      }
      if (unsubRef.current) {
        unsubRef.current();
      }
    };
  }, []);

  // ── Initialize RAG ──────────────────────────────────────────────────
  useEffect(() => {
    vectorStore.init();
  }, []);

  useEffect(() => {
    if (notes.length > 0) {
      // Debounce rebuild to avoid rebuilding on every notes array reference change
      const timeout = setTimeout(() => {
        vectorStore.buildIndex(notes, (phase, data) => {
          if (phase === 'embedding_progress') setEmbeddedCount(data.done);
        }).then(count => {
          setRagIndexed(count > 0);
          setEmbeddedCount(vectorStore.getEmbeddedCount());
        });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [notes.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── RAG Context Helper ──────────────────────────────────────────────
  const getRAGContext = useCallback(async (query) => {
    const result = await vectorStore.getRAGContext(query);
    setLastRAGSources(result.sources);
    return result.context;
  }, []);

  const getNoteContext = useCallback(() => {
    if (!activeNote) return '';
    return `Active note "${activeNote.title}": ${(activeNote.content || '').replace(/<[^>]*>/g, '').slice(0, 1000)}`;
  }, [activeNote]);

  // ── EventStream Handler ─────────────────────────────────────────────
  // All agent events flow through here. UI components update based on event type.
  const handleAgentEvent = useCallback((event) => {
    switch (event.type) {
      case AgentEventTypes.THINKING:
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.pending) {
            next[next.length - 1] = { ...last, text: event.text, pending: true };
          }
          return next;
        });
        break;

      case AgentEventTypes.PLAN_GENERATED:
        setCurrentPlan(event.plan);
        setAgentMode('checkpoint');
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.pending) {
            next[lastIdx] = { ...next[lastIdx], pending: false, plan: event.plan };
          }
          return next;
        });
        break;

      case AgentEventTypes.STEP_START:
        setCurrentStepIndex(event.stepIndex);
        setCurrentStep(event.step);
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.executing) {
            const plan = { ...next[lastIdx].plan };
            plan.steps = [...plan.steps];
            if (plan.steps[event.stepIndex]) {
              plan.steps[event.stepIndex] = { ...plan.steps[event.stepIndex], status: 'running' };
            }
            next[lastIdx] = { ...next[lastIdx], plan, currentStepIdx: event.stepIndex };
          }
          return next;
        });
        break;

      case AgentEventTypes.STEP_END:
        setCurrentStepIndex(event.stepIndex);
        setCurrentStep(event.step);
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.executing) {
            const plan = { ...next[lastIdx].plan };
            plan.steps = [...plan.steps];
            if (plan.steps[event.stepIndex]) {
              plan.steps[event.stepIndex] = { ...plan.steps[event.stepIndex], status: event.step.status };
            }
            next[lastIdx] = { ...next[lastIdx], plan, currentStepIdx: event.stepIndex };
          }
          return next;
        });
        break;

      case AgentEventTypes.TOOL_START:
        setMessages(prev => {
          const next = [...prev];
          const lastIdx = next.length - 1;
          if (next[lastIdx]?.executing) {
            next[lastIdx] = { ...next[lastIdx], lastTool: event.toolName, lastCommand: event.args?.command };
          }
          return next;
        });
        break;

      case AgentEventTypes.OUTPUT:
        setTerminalOutput(event);
        break;

      case AgentEventTypes.CHECKPOINT:
        setCurrentStep(event.step);
        setCurrentStepIndex(event.stepIndex);
        if (!event.autoResume) {
          setAgentMode('checkpoint');
        }
        break;

      case AgentEventTypes.CHECKPOINT_RESUME:
        setAgentMode('running');
        acknowledgeCheckpoint(true);
        break;

      case AgentEventTypes.CHECKPOINT_ABORT:
        setAgentRunning(false);
        setAgentMode('chat');
        acknowledgeCheckpoint(false);
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: 'Agent aborted by user.',
          aborted: true,
        }]);
        break;

      case AgentEventTypes.BUILD_LOG:
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: '',
          buildLog: event.buildLog,
        }]);
        break;

      case AgentEventTypes.AGENT_END:
        setAgentRunning(false);
        setAgentMode('chat');
        setCurrentPlan(null);
        setCurrentStep(null);
        if (event.error) {
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.pending) {
              next[next.length - 1] = { ...last, text: `Error: ${event.error}`, pending: false, error: true };
            } else {
              next.push({ role: 'assistant', text: `Error: ${event.error}`, error: true });
            }
            return next;
          });
        }
        break;

      case AgentEventTypes.ERROR:
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: `Error: ${event.message}`,
          error: true,
        }]);
        break;

      default:
        break;
    }
  }, []);

  // ── Chat (normal mode) ──────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming || agentRunning) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsStreaming(true);

    try {
      const noteContext = getNoteContext();
      const ragContext = await getRAGContext(text);
      const systemPrompt = `You are Flow's AI assistant. Answer concisely.\n\n${noteContext ? noteContext + '\n\n' : ''}${ragContext ? 'Relevant notes:\n' + ragContext : ''}`;

      setMessages(prev => [...prev, { role: 'assistant', text: '', pending: true }]);

      let fullResponse = '';
      await aiChat(text, systemPrompt, messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })), (chunk, fullText) => {
        fullResponse = fullText;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', text: fullText, pending: true };
          return next;
        });
      });

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', text: fullResponse, pending: false };
        return next;
      });
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', text: `Error: ${err.message}`, pending: false, error: true };
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // ── Agent Mode (plan + execute via EventStream) ─────────────────────
  const startAgent = async () => {
    const text = input.trim();
    if (!text) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setAgentRunning(true);
    setAgentMode('planning');

    // Create a fresh EventStream for this agent run
    const stream = new EventStream();
    streamRef.current = stream;

    // Subscribe once (Bug #37 fix — store unsubscribe)
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = stream.onAny((event) => {
      handleAgentEvent(event);
    });

    try {
      const noteContext = getNoteContext();
      const ragContext = await getRAGContext(text);
      const fullContext = noteContext + (ragContext ? '\n\nRelevant notes:\n' + ragContext : '');

      // Show thinking indicator
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: '',
        pending: true,
        planning: true,
      }]);

      // Generate plan
      const plan = await generatePlan({
        goal: text,
        noteContext: fullContext,
        stream,
      });

      // Plan is now shown via PLAN_GENERATED event → handleAgentEvent
      // Wait for user to approve via StepChecklist

    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.pending) {
          next[lastIdx] = { ...next[lastIdx], text: `Error: ${err.message}`, pending: false, error: true };
        } else {
          next.push({ role: 'assistant', text: `Error: ${err.message}`, error: true });
        }
        return next;
      });
      setAgentRunning(false);
      setAgentMode('chat');
    }
  };

  // ── Plan Approval ────────────────────────────────────────────────────
  const handleApprovePlan = async (approvedPlan) => {
    setCurrentPlan(approvedPlan);
    setAgentMode('running');

    setMessages(prev => [...prev, {
      role: 'assistant',
      text: '',
      executing: true,
      plan: approvedPlan,
    }]);

    const stream = streamRef.current || new EventStream();
    streamRef.current = stream;

    // Don't re-subscribe if already subscribed (Bug #37 fix)
    if (!unsubRef.current) {
      unsubRef.current = stream.onAny((event) => {
        handleAgentEvent(event);
      });
    }

    try {
      const noteContext = getNoteContext();
      const ragContext = await getRAGContext(approvedPlan.goal);
      const fullContext = noteContext + (ragContext ? '\n\nRelevant notes:\n' + ragContext : '');

      await executePlan({
        plan: approvedPlan,
        noteContext: fullContext,
        stream,
      });
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${err.message}`,
        error: true,
      }]);
      setAgentRunning(false);
      setAgentMode('chat');
    }
  };

  // ── Checkpoint Actions ──────────────────────────────────────────────
  const handleContinue = () => {
    setAgentMode('running');
    // acknowledgeCheckpoint is called by the CHECKPOINT_RESUME event handler
    if (streamRef.current) {
      streamRef.current.push({ type: AgentEventTypes.CHECKPOINT_RESUME });
    }
  };

  const handleAbort = () => {
    stopAgent();
    setAgentRunning(false);
    setAgentMode('chat');
    setCurrentPlan(null);
    setCurrentStep(null);
    // acknowledgeCheckpoint is called by stopAgent() + CHECKPOINT_ABORT event handler
    if (streamRef.current) {
      streamRef.current.push({ type: AgentEventTypes.CHECKPOINT_ABORT });
    }
  };

  // ── Keyboard & Input ────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (e.ctrlKey) {
        startAgent();
      } else {
        sendMessage();
      }
    }
  };

  const handleTerminalCommand = (cmd) => {
    setInput(`Run: $ ${cmd}`);
    textareaRef.current?.focus();
  };

  return (
    <div className="agent-layout">
      <div className="agent-chat">
        <div className="agent-panel-header">
          <span className="agent-panel-title">AI Agent</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {ragIndexed && (
              <span className="agent-panel-badge" style={{ background: 'hsla(142,71%,45%,.15)', color: 'hsl(142,71%,45%)' }}>
                RAG {embeddedCount > 0 && `(${embeddedCount})`}
              </span>
            )}
            {activeNote && (
              <span className="agent-panel-badge">{activeNote.title}</span>
            )}
            {agentRunning && (
              <span className="agent-panel-badge" style={{ background: 'hsla(24,95%,53%,.15)', color: 'hsl(24,95%,53%)' }}>
                {agentMode === 'planning' ? 'Planning...' : agentMode === 'checkpoint' ? 'Paused' : 'Running'}
              </span>
            )}
          </div>
        </div>

        <div className="agent-chat-messages">
          {messages.length === 0 && (
            <div className="agent-empty">
              <div className="agent-empty-icon">🤖</div>
              <div className="agent-empty-title">Flow Agent</div>
              <div className="agent-empty-desc">
                Ask questions about your notes, or give me a task.
                <br /><br />
                <strong>Enter</strong> to chat
                <br />
                <strong>Ctrl+Enter</strong> for agent mode (plan + execute)
              </div>
              {ragIndexed && (
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--success)' }}>
                  Vector RAG active — {embeddedCount} chunks indexed from {notes.length} notes
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`agent-msg ${msg.role} ${msg.error ? 'error' : ''}`}>
              {/* Planning indicator */}
              {msg.planning && (
                <div className="agent-planning">
                  <div className="agent-planning-spinner" />
                  <span>Generating plan...</span>
                </div>
              )}

              {/* Plan display */}
              {msg.plan && !msg.executing && (
                <StepChecklist
                  plan={msg.plan}
                  onApprove={handleApprovePlan}
                  onAbort={handleAbort}
                />
              )}

              {/* Executing plan */}
              {msg.executing && (
                <div className="agent-executing">
                  {msg.lastTool && (
                    <div className="agent-executing-thought">
                      Running {msg.lastTool}{msg.lastCommand ? `: ${msg.lastCommand}` : ''}
                    </div>
                  )}

                  <div className="agent-executing-steps">
                    {msg.plan?.steps?.map((step, si) => (
                      <div
                        key={si}
                        className={`agent-step ${step.status} ${si === msg.currentStepIdx ? 'current' : ''}`}
                      >
                        <span className="agent-step-icon">
                          {step.status === 'completed' ? '✓' :
                           step.status === 'failed' ? '✕' :
                           step.status === 'running' ? '◌' :
                           step.status === 'skipped' ? '⊘' : '○'}
                        </span>
                        <span className="agent-step-desc">{step.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checkpoint UI */}
              {msg.executing && agentMode === 'checkpoint' && currentStep?.checkpoint !== false && (
                <StepCheckpoint
                  step={currentStep}
                  stepIndex={currentStepIndex}
                  totalSteps={currentPlan?.steps?.length || 0}
                  onContinue={handleContinue}
                  onSkip={handleContinue}
                  onAbort={handleAbort}
                />
              )}

              {/* Build log */}
              {msg.buildLog && (
                <div className="agent-build-log">
                  <div className="agent-build-log-header">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Build Complete</span>
                    <span className={`build-outcome ${msg.buildLog.outcome}`}>
                      {msg.buildLog.outcome}
                    </span>
                  </div>
                  <div className="agent-build-log-stats">
                    {msg.buildLog.stats.completed} completed, {msg.buildLog.stats.failed} failed, {msg.buildLog.stats.skipped} skipped
                  </div>
                </div>
              )}

              {/* Plain text message */}
              {msg.text && !msg.plan && !msg.executing && !msg.buildLog && (
                <MessageContent text={msg.text} onRunCommand={handleTerminalCommand} />
              )}

              {/* RAG Sources */}
              {i === messages.length - 1 && lastRAGSources.length > 0 && !msg.plan && !msg.executing && (
                <SourcesPanel sources={lastRAGSources} />
              )}

              {msg.pending && <span className="cursor-blink">▊</span>}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="agent-chat-input">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentRunning ? 'Agent running...' : 'Ask anything... (Ctrl+Enter for agent mode)'}
            rows={1}
            disabled={isStreaming || agentRunning}
          />
          {agentRunning ? (
            <button className="agent-chat-send stop" onClick={handleAbort} title="Stop">
              ■
            </button>
          ) : (
            <button className="agent-chat-send" onClick={sendMessage} disabled={!input.trim() || isStreaming} title="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="agent-right">
        <TerminalPanel
          onCommandRun={handleTerminalCommand}
          onOutputCapture={(output) => {
            // Feed terminal output back to agent context for AI awareness
            if (streamRef.current && agentRunning) {
              streamRef.current.push({
                type: 'output',
                toolName: 'terminal',
                command: output.command,
                stdout: output.stdout,
                stderr: output.stderr,
              });
            }
          }}
        />
      </div>
    </div>
  );
}

function MessageContent({ text, onRunCommand }) {
  if (!text) return null;

  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        const codeMatch = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
        if (codeMatch) {
          const lang = codeMatch[1] || '';
          const code = codeMatch[2].trim();
          const isCommand = code.startsWith('$ ');

          return (
            <div key={i}>
              {lang && <div style={{ fontSize: '0.65rem', color: 'var(--tx-tertiary)', marginBottom: 2 }}>{lang}</div>}
              <pre><code>{code}</code></pre>
              {isCommand && (
                <div className="agent-cmd-actions" style={{ marginTop: 4 }}>
                  <button className="agent-cmd-run" onClick={() => onRunCommand(code.replace(/^\$ /, ''))}>
                    ▶ Run
                  </button>
                </div>
              )}
            </div>
          );
        }

        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((ip, j) => {
              if (ip.startsWith('`') && ip.endsWith('`')) {
                return <code key={j}>{ip.slice(1, -1)}</code>;
              }
              return <span key={j}>{ip}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}
