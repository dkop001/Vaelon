import { Sparkles, MessageSquare, Wand2, FileText, Lightbulb } from 'lucide-react';

const AI_TOOLS = [
  { id: 'chat', label: 'Workspace Chat', icon: MessageSquare },
  { id: 'explain', label: 'Explain', icon: Lightbulb },
  { id: 'rewrite', label: 'Rewrite', icon: Wand2 },
  { id: 'summarize', label: 'Summarize', icon: FileText },
];

export default function RightSidebar({ isOpen, onClose }) {
  return (
    <div className={`right-panel${isOpen ? ' open' : ''}`}>
      <div className="right-panel-header">AI Assistant</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {AI_TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
              padding: 'var(--space-6) var(--space-8)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--weight-medium)',
              transition: 'var(--transition)',
              minHeight: '36px',
              cursor: 'pointer',
              border: 'none',
              background: 'none',
              textAlign: 'left',
              width: '100%',
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Icon size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-12)' }}>
        <div className="right-panel-header" style={{ marginBottom: 'var(--space-6)' }}>Quick Actions</div>
        <div style={{
          padding: 'var(--space-8)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>AI Suggestions</span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
            Select text in the editor to get AI-powered suggestions for rewriting, explaining, or translating.
          </p>
        </div>
      </div>
    </div>
  );
}
