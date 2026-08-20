import { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import { useChatStore } from '../../store/chatStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAgentMemoryStore } from '../../store/agentMemoryStore';
import { useDocumentStore } from '../../store/noteStore';
import { buildProjectContext } from '../../lib/projectContext';
import { api, onEvent, ProjectIntelligence } from '../../ipc/client';
import FilePreviewPanel from '../../features/editor/FilePreviewPanel';
// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  close: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  send: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M12.5 1.5 1 6l5 1.5M12.5 1.5 8 13l-2-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  ai: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
    </svg>
  ),
  context: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      {/* stacked context planes */}
      <rect x="2" y="5.6" width="8.4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="3.6" y="2.6" width="8.4" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.2" opacity="0.55"/>
      <circle cx="6.2" cy="8.6" r="1.15" fill="currentColor"/>
      <path d="M7.6 8.6h2.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  summarize: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  copy: () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2.5 8.5H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v.5" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  ),
  check: () => (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  spinner: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="animate-spin">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22 12" strokeLinecap="round"/>
    </svg>
  ),
};

// ── Typing dots ────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--accent)',
          animation: `typing 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes typing{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}`}</style>
    </span>
  );
}

interface MsgItem {
  role: 'user' | 'ai';
  text: string;
}

// ── Chat Message ──────────────────────────────────────────────────────────────
function ChatMessage({ msg, isLast, isLoading }: { msg: MsgItem; isLast: boolean; isLoading: boolean }) {
  const isAI = msg.role === 'ai';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isAI ? 'row' : 'row-reverse' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        background: isAI ? 'var(--accent)' : 'var(--bg-overlay)',
        border: isAI ? 'none' : '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: isAI ? 'white' : 'var(--tx-secondary)',
        boxShadow: isAI ? '0 0 10px hsla(211,100%,60%,.25)' : 'none',
      }}>
        {isAI ? '✦' : 'U'}
      </div>
      <div style={{
        maxWidth: '82%',
        background: isAI ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
        border: `1px solid ${isAI ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
        borderRadius: isAI ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
        padding: '8px 12px',
        fontSize: 'var(--text-sm)', lineHeight: 1.65, color: 'var(--tx-primary)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.text}
        {isLast && isLoading && <TypingDots />}
      </div>
    </div>
  );
}

// ── Main AIPanel (Context Panel) ───────────────────────────────────────────
export default function AIPanel() {
  const { rightPanelTab, setRightPanelTab, toggleRightPanel, backgroundServices, previewFilePath, previewFileName } = useAppStore();
  const { notes, activeNoteId } = useNoteStore();
  const { activeWorkspaceId, activeProjectId, getActiveWorkspace } = useWorkspaceStore();
  const chatStore = useChatStore();
  const { createSession, sendMessage } = chatStore;
  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  const handleOpenInDocuments = async (path: string, name: string) => {
    const { activeWorkspaceId, activeProjectId } = useWorkspaceStore.getState();
    const { createDocument, updateDocument, documents } = useDocumentStore.getState();
    if (activeWorkspaceId && activeProjectId) {
      try {
        const content = await api.fsRead(path);
        await createDocument(activeWorkspaceId, activeProjectId, name, 'knowledge');
        const newDoc = documents[0];
        if (newDoc) {
          await updateDocument({ ...newDoc, content: `<pre>${content.replace(/</g, '<').replace(/>/g, '>')}</pre>` });
        }
      } catch (err) {
        console.error('Failed to open in documents:', err);
      }
    }
  };

  // Chat state
  const [chatMessages, setChatMessages] = useState<MsgItem[]>([
    { role: 'ai', text: "Hi! I'm your AI assistant. Select a document and ask me to summarize it, or ask any question about your project." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Summary state
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Project Intelligence state
  const [intel, setIntel] = useState<ProjectIntelligence | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);

  // Agent memories
  const { memories, loadMemories } = useAgentMemoryStore();
  const projectMeta = useWorkspaceStore((s) => s.projectMeta);

  // FR-6: exactly what the model receives, kept live for the Context tab.
  const projectCtx = useMemo(
    () => buildProjectContext(activeNote),
    [activeNote, projectMeta, memories]
  );
  const [ctxOpen, setCtxOpen] = useState(false);

  const activeWs = getActiveWorkspace();

  // Load memories when the workspace changes
  useEffect(() => {
    if (activeWorkspaceId) {
      loadMemories(activeProjectId ?? '', activeWorkspaceId);
    }
  }, [activeWorkspaceId, activeProjectId, loadMemories]);

  // Auto-load Project DNA on workspace change
  useEffect(() => {
    if (activeWs) {
      setIntelLoading(true);
      setIntelError(null);
      api.projectIntelligence(activeWs.path)
        .then(setIntel)
        .catch((err: any) => setIntelError(err?.message ?? 'Failed to index workspace'))
        .finally(() => setIntelLoading(false));
    } else {
      setIntel(null);
    }
  }, [activeWs?.path]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Reset on document change
  useEffect(() => {
    setSummary(null);
    setChatMessages([
      { role: 'ai', text: "Hi! I'm your AI assistant. Select a document and ask me to summarize it, or ask any question about your project." }
    ]);
  }, [activeNoteId]);

  // Subscribe to streaming LLM chunks
  useEffect(() => {
    const unsub = onEvent<{ session_id: string; content: string }>(
      'llm:chunk',
      ({ content }) => {
        setChatMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'ai') {
            updated[updated.length - 1] = { role: 'ai', text: last.text + content };
          }
          return updated;
        });
      }
    );
    const unsubDone = onEvent<{ session_id: string }>('llm:done', () => {
      setChatLoading(false);
    });
    const unsubError = onEvent<{ session_id: string; message: string }>('llm:error', ({ message }) => {
      setChatLoading(false);
      setChatMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'ai') {
          updated[updated.length - 1] = { role: 'ai', text: `Error: ${message || 'LLM request failed'}` };
        }
        return updated;
      });
    });
    return () => { unsub(); unsubDone(); unsubError(); };
  }, []);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', text }]);
    setChatMessages(prev => [...prev, { role: 'ai', text: '' }]);
    setChatLoading(true);

    try {
      const sessionId = useChatStore.getState().activeSessionId;
      if (!sessionId && activeWorkspaceId) {
        await createSession(activeWorkspaceId, activeProjectId ?? '');
      }
      const ctx = buildProjectContext(activeNote);
      await sendMessage(text, ctx.context);

      // FR-2: deterministic chat capture — no model call, narrow triggers only.
      if (activeWorkspaceId && activeProjectId) {
        const sid = useChatStore.getState().activeSessionId ?? '';
        useAgentMemoryStore
          .getState()
          .captureFromChat({ userText: text, projectId: activeProjectId, workspaceId: activeWorkspaceId, sessionId: sid })
          .catch(() => {});
      }
    } catch (err: any) {
      setChatLoading(false);
      setChatMessages(prev => [
        ...prev.slice(0, -2),
        { role: 'user', text },
        { role: 'ai', text: `Error: ${err?.message ?? 'Unknown error'}` },
      ]);
    }
  };

  const handleChatKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // ── Summarize ──────────────────────────────────────────────────────────────
  const generateSummary = async () => {
    if (!activeNote?.content?.trim()) return;
    setSummaryLoading(true);
    setSummary('');
    try {
      const plainText = activeNote.content.replace(/<[^>]*>/g, '').trim();
      const messages = [
        { role: 'system', content: 'You are a concise AI assistant. Summarize the provided document clearly and briefly.' },
        { role: 'user', content: plainText },
      ];
      const result = await api.llmComplete(messages, 0.3, 512);
      setSummary(result);
    } catch (err: any) {
      setSummary(`Error: ${err?.message}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  const copySummary = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch { /* noop */ }
  };

  // ── Project Intelligence ───────────────────────────────────────────────
  const loadIntelligence = async () => {
    const ws = getActiveWorkspace();
    if (!ws) return;
    setIntelLoading(true);
    setIntelError(null);
    try {
      const data = await api.projectIntelligence(ws.path);
      setIntel(data);
    } catch (err: any) {
      setIntelError(err?.message ?? 'Failed to index workspace');
    } finally {
      setIntelLoading(false);
    }
  };

  useEffect(() => {
    setIntel(null);
    setIntelError(null);
  }, [activeWorkspaceId]);

  const TABS: { id: 'context' | 'chat' | 'summary' | 'intel' | 'preview' | 'agent'; label: string }[] = [
    { id: 'context', label: 'Context' },
    { id: 'chat', label: 'Chat' },
    { id: 'summary', label: 'Summary' },
    { id: 'intel', label: 'Intel' },
    { id: 'preview', label: 'Preview' },
    { id: 'agent', label: 'Agent' },
  ];

  return (
    <aside className="ai-panel workspace-right" aria-label="AI Panel" id="ai-panel">
      {/* ── Header ── */}
      <div className="ai-panel-header">
        <div className="ai-panel-logo"><Ico.context /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ai-panel-title">Context Panel</div>
          <div className="ai-panel-subtitle">
            {activeNote ? `Context: ${activeNote.title?.slice(0, 24) || 'Untitled'}` : 'Live project intelligence'}
          </div>
        </div>
        <button className="btn btn-icon-sm btn-ghost" onClick={toggleRightPanel} aria-label="Close AI panel" id="ai-panel-close">
          <Ico.close />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="ai-panel-tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`ai-tab ${rightPanelTab === t.id ? 'active' : ''}`}
            onClick={() => setRightPanelTab(t.id)}
            role="tab"
            aria-selected={rightPanelTab === t.id}
            id={`ai-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Context Tab ── */}
      {rightPanelTab === 'context' && (
        <div className="ai-panel-body">
          {/* Background services */}
          <div className="summary-card">
            <div className="summary-header">
              <div className="summary-title"><Ico.ai /> Background Services</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 'var(--sp-3) var(--sp-4)' }}>
              {(Object.keys(backgroundServices) as (keyof typeof backgroundServices)[]).map((svc) => {
                const status = backgroundServices[svc];
                const label = svc === 'gitWatcher' ? 'Git Watcher' : svc === 'buildWatcher' ? 'Build Watcher' : svc === 'indexer' ? 'File Indexer' : 'Agent';
                return (
                  <div key={svc} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`live-badge ${status}`} style={{ flexShrink: 0 }}>
                      <span className="dot" />
                      {status === 'active' ? 'Live' : status === 'starting' ? 'Starting' : status === 'error' ? 'Error' : 'Idle'}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Project DNA summary */}
          {activeWs ? (
            intel ? (
              <div className="summary-card">
                <div className="summary-header">
                  <div className="summary-title"><Ico.ai /> Project DNA</div>
                  <button className="btn btn-sm btn-secondary" onClick={loadIntelligence} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Re-index
                  </button>
                </div>
                <div className="intel-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 'var(--sp-3) var(--sp-4)' }}>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.indexed_files}</div>
                    <div className="intel-stat-label">Files</div>
                  </div>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.symbols}</div>
                    <div className="intel-stat-label">Symbols</div>
                  </div>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.dna?.total_symbols ?? 0}</div>
                    <div className="intel-stat-label">Indexed</div>
                  </div>
                </div>
                {intel.dna?.architecture && (
                  <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
                    <div className="intel-stat-label" style={{ marginBottom: 4 }}>Architecture</div>
                    {intel.dna.architecture}
                  </div>
                )}
              </div>
            ) : (
              <button className="ai-action-btn" onClick={loadIntelligence} disabled={intelLoading}>
                <span className="btn-icon"><Ico.ai /></span>
                {intelLoading ? 'Indexing…' : intelError ? 'Retry Indexing' : 'Generate Project DNA'}
                {intelLoading && <Ico.spinner />}
              </button>
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--tx-tertiary)', fontSize: 'var(--text-sm)' }}>
              <div style={{ fontSize: 26, marginBottom: 8, opacity: .4 }}>✦</div>
              Open a project to see its architecture DNA.
            </div>
          )}

          {/* Live context (FR-6) */}
          <div className="summary-card">
            <div className="summary-header">
              <div className="summary-title"><Ico.ai /> Live Context</div>
              <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setCtxOpen((v) => !v)}>
                {ctxOpen ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ padding: 'var(--sp-3) var(--sp-4)', fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
              {(() => {
                const parts: string[] = [];
                if (projectCtx.report.identity) parts.push('project identity');
                if (projectCtx.report.memoryIncluded > 0) parts.push(`${projectCtx.report.memoryIncluded} memories`);
                if (projectCtx.report.documentIncluded) parts.push('active document');
                if (parts.length === 0) return 'No project context. Open a project or add memory to ground the AI.';
                return (
                  <>
                    <div>Sent with every message: <strong style={{ color: 'var(--tx-primary)' }}>{parts.join(', ')}</strong></div>
                    {projectCtx.report.memoryOmitted > 0 && (
                      <div style={{ color: 'var(--warning)', marginTop: 4 }}>
                        {projectCtx.report.memoryOmitted} older memories omitted for space.
                      </div>
                    )}
                  </>
                );
              })()}
              {ctxOpen && projectCtx.context && (
                <pre style={{ maxHeight: 260, overflow: 'auto', margin: '8px 0 0', padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {projectCtx.context}
                </pre>
              )}
            </div>
          </div>

          {/* Recent memories */}
          <div className="summary-card">
            <div className="summary-header">
              <div className="summary-title"><Ico.ai /> Memories</div>
              <button
                onClick={() => useAppStore.getState().setActiveView('memory')}
                className="btn btn-sm btn-ghost"
                style={{ marginLeft: 'auto' }}
              >
                View all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--sp-3) var(--sp-4)' }}>
              {memories.length === 0 && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-tertiary)', padding: '8px 0' }}>
                  No memories yet. They'll appear as the agent learns about this project.
                </div>
              )}
              {memories.slice(0, 8).map((m) => (
                <div key={m.id} style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', fontSize: 9 }}>{m.type}</span>
                  {m.source && m.source !== 'user-confirmed' && (
                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: 'var(--warning)' }}>
                      {m.source === 'ai-inferred' ? 'ai' : 'auto'}
                    </span>
                  )}
                  <div style={{ marginTop: 2 }}>{m.value.slice(0, 90)}{m.value.length > 90 ? '…' : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Tab ── */}
      {rightPanelTab === 'chat' && (
        <>
          <div className="chat-messages" aria-live="polite">
            {chatMessages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} isLast={i === chatMessages.length - 1} isLoading={chatLoading} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          {chatMessages.length === 1 && activeNote && (
            <div style={{ padding: '0 var(--sp-5) var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Summarize this document briefly', 'What are the key takeaways?', 'Explain the architecture'].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setChatInput(prompt); chatInputRef.current?.focus(); }}
                  style={{
                    textAlign: 'left', padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)', fontSize: 'var(--text-xs)',
                    color: 'var(--tx-secondary)', cursor: 'pointer', transition: 'var(--t-fast)',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-area">
            <textarea
              ref={chatInputRef}
              className="chat-input"
              placeholder={activeNote ? 'Ask about your document…' : 'Select a document first…'}
              value={chatInput}
              onChange={handleInputChange}
              onKeyDown={handleChatKey}
              rows={1}
              aria-label="Chat input"
              id="ai-chat-input"
              disabled={chatLoading}
              style={{ height: 36 }}
            />
            <button
              className="chat-send-btn"
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send message"
              id="ai-chat-send"
            >
              {chatLoading ? <Ico.spinner /> : <Ico.send />}
            </button>
          </div>
        </>
      )}

      {/* ── Summary Tab ── */}
      {rightPanelTab === 'summary' && (
        <div className="ai-panel-body">
          <button
            className="ai-action-btn"
            onClick={generateSummary}
            disabled={summaryLoading || !activeNote?.content?.trim()}
            id="ai-summarize-btn"
          >
            <span className="btn-icon"><Ico.summarize /></span>
            {summaryLoading ? 'Summarizing…' : summary ? 'Re-summarize' : 'Summarize Document'}
            {summaryLoading && <Ico.spinner />}
          </button>

          {!activeNote && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-tertiary)', fontSize: 'var(--text-sm)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: .4 }}>✦</div>
              Select or create a document to summarize it.
            </div>
          )}

          {summaryLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[100, 80, 90, 65].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 12, width: `${w}%`, borderRadius: 6 }} />
              ))}
            </div>
          )}

          {summary && !summaryLoading && (
            <div className="summary-card">
              <div className="summary-header">
                <div className="summary-title"><Ico.ai /> AI Summary</div>
                <button className="btn btn-sm btn-secondary" onClick={copySummary} id="summary-copy-btn" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {copiedSummary ? <Ico.check /> : <Ico.copy />}
                  {copiedSummary ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="summary-body">{summary}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Intelligence Tab ── */}
      {rightPanelTab === 'intel' && (
        <div className="ai-panel-body">
          {!activeWs && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-tertiary)', fontSize: 'var(--text-sm)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: .4 }}>✦</div>
              Open a workspace to analyze its structure.
            </div>
          )}
          {activeWs && !intel && !intelLoading && (
            <button
              className="ai-action-btn"
              onClick={loadIntelligence}
              id="ai-intel-btn"
            >
              <span className="btn-icon"><Ico.ai /></span>
              {intelError ? 'Retry Indexing' : 'Index Workspace'}
            </button>
          )}
          {intelError && !intel && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
              {intelError}
            </div>
          )}
          {intelLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[100, 80, 90, 65, 75].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 12, width: `${w}%`, borderRadius: 6 }} />
              ))}
            </div>
          )}
          {intel && !intelLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="summary-card">
                <div className="summary-header">
                  <div className="summary-title"><Ico.ai /> Project DNA</div>
                  <button className="btn btn-sm btn-secondary" onClick={loadIntelligence} id="ai-intel-refresh" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Re-index
                  </button>
                </div>
                <div className="intel-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: 'var(--sp-3) var(--sp-4)' }}>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.indexed_files}</div>
                    <div className="intel-stat-label">Files</div>
                  </div>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.symbols}</div>
                    <div className="intel-stat-label">Symbols</div>
                  </div>
                  <div className="intel-stat">
                    <div className="intel-stat-value">{intel.dna?.total_symbols ?? 0}</div>
                    <div className="intel-stat-label">Indexed</div>
                  </div>
                </div>
              </div>

              {intel.dna && (
                <div className="intel-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Architecture', value: intel.dna.architecture },
                    { label: 'Directories', value: intel.dna.directories },
                    { label: 'Extensions', value: intel.dna.extensions },
                  ].filter(r => r.value).map(r => (
                    <div key={r.label}>
                      <div className="intel-stat-label" style={{ marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-primary)', lineHeight: 1.5 }}>{r.value}</div>
                    </div>
                  ))}
                  {intel.dna.hot_symbols.length > 0 && (
                    <div>
                      <div className="intel-stat-label" style={{ marginBottom: 4 }}>Hot Symbols</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {intel.dna.hot_symbols.map(s => (
                          <code key={s} style={{ padding: '2px 7px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>{s}</code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Preview Tab ── */}
      {rightPanelTab === 'preview' && (
        <FilePreviewPanel
          filePath={previewFilePath || ''}
          fileName={previewFileName || 'Unknown'}
          onClose={() => setRightPanelTab('context')}
          onOpenInDocuments={handleOpenInDocuments}
        />
      )}
    </aside>
  );
}