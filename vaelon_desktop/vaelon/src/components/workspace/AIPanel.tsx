import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useNoteStore } from '../../store/noteStore';
import { useChatStore } from '../../store/chatStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { api, onEvent } from '../../ipc/client';

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
  summarize: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M4 4.5h6M4 7h6M4 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  quiz: () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
        background: isAI ? 'var(--grad-brand)' : 'var(--bg-overlay)',
        border: isAI ? 'none' : '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: isAI ? 'white' : 'var(--tx-secondary)',
        boxShadow: isAI ? '0 0 8px hsla(258,88%,68%,.3)' : 'none',
      }}>
        {isAI ? '✦' : 'U'}
      </div>
      <div style={{
        maxWidth: '82%',
        background: isAI ? 'linear-gradient(135deg, var(--accent-muted), var(--bg-elevated))' : 'var(--bg-elevated)',
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

// ── Main AIPanel ──────────────────────────────────────────────────────────────
export default function AIPanel() {
  const { rightPanelTab, setRightPanelTab, toggleRightPanel } = useAppStore();
  const { notes, activeNoteId } = useNoteStore();
  const { activeWorkspaceId, activeProjectId } = useWorkspaceStore();
  const chatStore = useChatStore();
  const { createSession, sendMessage } = chatStore;
  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  // Chat state
  const [chatMessages, setChatMessages] = useState<MsgItem[]>([
    { role: 'ai', text: "Hi! I'm your Note AI assistant. Select a note and ask me to summarize it, generate a quiz, or ask any question about your knowledge." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Summary state
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Reset on note change
  useEffect(() => {
    setSummary(null);
    setChatMessages([
      { role: 'ai', text: "Hi! I'm your Note AI assistant. Select a note and ask me to summarize it, generate a quiz, or ask any question about your knowledge." }
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
    return () => { unsub(); unsubDone(); };
  }, []);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', text }]);
    setChatMessages(prev => [...prev, { role: 'ai', text: '' }]);
    setChatLoading(true);

    try {
      if (!useChatStore.getState().activeSessionId && activeWorkspaceId) {
        await createSession(activeWorkspaceId, activeProjectId ?? '');
      }
      const noteContext = activeNote?.content?.replace(/<[^>]*>/g, '') ?? '';
      await sendMessage(text, noteContext || undefined);
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
        { role: 'system', content: 'You are a concise AI assistant. Summarize the provided note clearly and briefly.' },
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

  const TABS: { id: 'chat' | 'summary' | 'quiz'; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'summary', label: 'Summary' },
    { id: 'quiz', label: 'Quiz' },
  ];

  return (
    <aside className="ai-panel workspace-right" aria-label="AI Panel" id="ai-panel">
      {/* ── Header ── */}
      <div className="ai-panel-header">
        <div className="ai-panel-logo"><Ico.ai /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ai-panel-title">AI Assistant</div>
          <div className="ai-panel-subtitle">
            {activeNote ? `Context: ${activeNote.title?.slice(0, 24) || 'Untitled'}` : 'Select a note to begin'}
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
              {['Summarize this note briefly', 'What are the key takeaways?', 'Generate 3 quiz questions'].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setChatInput(prompt); chatInputRef.current?.focus(); }}
                  style={{
                    textAlign: 'left', padding: '6px 10px',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
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
              placeholder={activeNote ? 'Ask about your note…' : 'Select a note first…'}
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
            {summaryLoading ? 'Summarizing…' : summary ? 'Re-summarize' : 'Summarize Note'}
            {summaryLoading && <Ico.spinner />}
          </button>

          {!activeNote && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--tx-tertiary)', fontSize: 'var(--text-sm)' }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: .4 }}>✦</div>
              Select or create a note to summarize it.
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

      {/* ── Quiz Tab ── */}
      {rightPanelTab === 'quiz' && (
        <div className="ai-panel-body">
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-muted), hsla(296,80%,60%,.08))',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px 16px', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎓</div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 4 }}>
              Study Quiz Generator
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)', lineHeight: 1.6 }}>
              Generate multiple-choice questions from your active note.
            </div>
          </div>

          <button
            className="ai-action-btn"
            disabled={!activeNote?.content?.trim()}
            id="ai-quiz-launch-btn"
            onClick={() => {
              // Future: integrate quiz generation via Rust LLM
              setChatInput('Generate 5 multiple-choice quiz questions from this note.');
              setRightPanelTab('chat');
            }}
          >
            <span className="btn-icon"><Ico.quiz /></span>
            Generate Quiz from Note
          </button>

          {activeNote && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--tx-tertiary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--tx-secondary)' }}>Active note:</strong>{' '}
              {activeNote.title || 'Untitled'} · {(activeNote.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length) || 0} words
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
