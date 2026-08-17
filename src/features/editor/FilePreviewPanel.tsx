import { useState, useEffect } from 'react';
import { api } from '../../ipc/client';
import { useAppStore } from '../../store/appStore';

// ── Icons ───────────────────────────────────────────────────────────────────────
const IconFile = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...props}>
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const IconCopy = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" {...props}>
    <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M2.5 8.5H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v.5" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
);
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" {...props}>
    <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconSpinner = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }} {...props}>
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="18 10" strokeLinecap="round"/>
  </svg>
);
const IconOpenInDoc = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" {...props}>
    <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M2 8.5l4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconX = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...props}>
    <path d="M1 1l10 10M11 1 1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

// ── Language detection ──────────────────────────────────────────────────────────
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', html: 'html', css: 'css', scss: 'scss', less: 'less',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c', h: 'c',
    hpp: 'cpp', cs: 'csharp', php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', ps1: 'powershell',
    sql: 'sql', md: 'markdown', markdown: 'markdown', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini', config: 'ini',
    dockerfile: 'dockerfile', dockerignore: 'dockerfile',
    gitignore: 'gitignore', gitattributes: 'gitignore',
    xml: 'xml', svg: 'xml', vue: 'vue', svelte: 'svelte',
    txt: 'plaintext', log: 'plaintext',
  };
  return map[ext] || 'plaintext';
}

// ── Simple syntax highlighter (lightweight, no external deps) ───────────────────
interface Token { type: string; content: string; }

function simpleHighlight(code: string, lang: string): Token[] {
  if (lang === 'plaintext') {
    return [{ type: 'plain', content: code }];
  }
  // For simplicity, just return plain text with basic line splitting
  // A full highlighter would be more complex; we'll keep it lightweight
  return [{ type: 'plain', content: code }];
}

function renderHighlighted(code: string, lang: string) {
  const tokens = simpleHighlight(code, lang);
  return (
    <pre className="file-preview-code" style={{ 
      margin: 0, 
      padding: 'var(--sp-4)', 
      fontFamily: 'var(--font-mono, monospace)', 
      fontSize: '12px', 
      lineHeight: 1.6,
      overflow: 'auto',
      maxHeight: 'calc(100vh - 200px)',
      whiteSpace: 'pre',
      tabSize: 2,
    }}>
      {tokens.map((token, i) => (
        <span key={i} style={{ color: getTokenColor(token.type) }}>{token.content}</span>
      ))}
    </pre>
  );
}

function getTokenColor(type: string): string {
  switch (type) {
    case 'comment': return 'var(--tx-disabled)';
    case 'string': return '#ce9178';
    case 'keyword': return '#c586c0';
    case 'number': return '#b5cea8';
    case 'function': return '#dcdcaa';
    default: return 'var(--tx-primary)';
  }
}

// ── FilePreviewPanel ───────────────────────────────────────────────────────────
interface FilePreviewPanelProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
  onOpenInDocuments: (path: string, name: string) => void;
}

export default function FilePreviewPanel({ filePath, fileName, onClose, onOpenInDocuments }: FilePreviewPanelProps) {
  const { setRightPanelTab } = useAppStore();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lang = getLanguageFromPath(filePath);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setContent('');
    
    api.fsRead(filePath)
      .then((text) => {
        if (mounted) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err?.message || 'Failed to read file');
          setLoading(false);
        }
      });
    
    return () => { mounted = false; };
  }, [filePath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenInDocuments = () => {
    onOpenInDocuments(filePath, fileName);
    onClose();
    setRightPanelTab('chat'); // Switch to chat for AI interaction with the new document
  };

  return (
    <div className="file-preview-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="file-preview-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 'var(--sp-3)', 
        padding: 'var(--sp-2) var(--sp-4)', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        flexShrink: 0,
      }}>
        <button 
          className="btn btn-icon-sm btn-ghost" 
          onClick={onClose} 
          aria-label="Close preview"
          style={{ flexShrink: 0 }}
        >
          <IconX />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconFile style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--weight-medium)', 
            color: 'var(--tx-primary)',
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {fileName}
          </span>
          <span style={{ 
            fontSize: 'var(--text-xs)', 
            color: 'var(--tx-tertiary)', 
            background: 'var(--bg-surface)', 
            padding: '2px 6px', 
            borderRadius: 'var(--radius-xs)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}>
            {lang}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button 
            className="btn btn-sm btn-secondary" 
            onClick={handleCopy}
            disabled={loading || !content}
            title="Copy content"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {copied ? <IconCheck /> : <IconCopy />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button 
            className="btn btn-sm btn-primary" 
            onClick={handleOpenInDocuments}
            disabled={loading || !content}
            title="Open in Documents for AI summarization/notes"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <IconOpenInDoc /> Open in Documents
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: 'var(--bg-surface)' }}>
        {loading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: 'var(--tx-tertiary)',
            gap: 8,
          }}>
            <IconSpinner />
            <span>Loading {fileName}…</span>
          </div>
        )}
        {error && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: 'var(--danger)',
            padding: 'var(--sp-6)',
            textAlign: 'center',
            gap: 8,
          }}>
            <svg width="32" height="32" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.6 }}>
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              Failed to load file
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-tertiary)' }}>
              {error}
            </div>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => { setLoading(true); setError(null); }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && content !== undefined && (
          <div style={{ height: '100%' }}>
            {renderHighlighted(content, lang)}
          </div>
        )}
        {!loading && !error && content === '' && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: 'var(--tx-tertiary)',
          }}>
            <span>(empty file)</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .file-preview-code { counter-reset: line; }
        .file-preview-code::before {
          content: counter(line);
          counter-increment: line;
          display: inline-block;
          width: 2.5rem;
          text-align: right;
          margin-right: 1rem;
          color: var(--tx-disabled);
          user-select: none;
          border-right: 1px solid var(--border-subtle);
          padding-right: 0.5rem;
        }
      `}</style>
    </div>
  );
}