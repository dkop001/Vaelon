import { Home, FileText, BrainCircuit, BookOpen, Share2, Search, Settings, Sparkles } from 'lucide-react';

const SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'notes', label: 'Notes', icon: FileText },
      { id: 'ai', label: 'AI Studio', icon: BrainCircuit },
      { id: 'study', label: 'Study', icon: BookOpen },
      { id: 'graph', label: 'Knowledge Graph', icon: Share2 },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'search', label: 'Search', icon: Search },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function LeftSidebar({ currentView, onViewChange, isOpen }) {
  return (
    <div className={`sidebar${isOpen ? ' open' : ''}`}>
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="sidebar-section-label">{section.label}</div>
          {section.items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`sidebar-item${currentView === id ? ' active' : ''}`}
              onClick={() => onViewChange(id)}
            >
              <Icon size={18} className="sidebar-item-icon" />
              {label}
            </button>
          ))}
        </div>
      ))}
      <div className="sidebar-spacer" />
      <div style={{
        padding: 'var(--space-6)', marginTop: 'auto',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-active)',
          fontSize: 'var(--text-xs)', color: 'var(--accent-primary)',
          fontWeight: 'var(--weight-semibold)',
        }}>
          <Sparkles size={14} />
          v2.0 Workspace
        </div>
      </div>
    </div>
  );
}
