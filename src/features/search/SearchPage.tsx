import { useState, useRef, useEffect } from 'react';
import { useDocumentStore, Document } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 15 15" fill="none">
    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="m10 10 3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IconDocument = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 5h6M4 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M1 1l10 10M11 1 1 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M6 4v2l1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stripHtml(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

function highlight(text: string, query: string): string {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return parts.map((part) =>
    part.toLowerCase() === query.toLowerCase()
      ? `<mark class="search-highlight">${part}</mark>`
      : part
  ).join('');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface ResultItemProps {
  document: Document;
  query: string;
  onOpen: (id: string) => void;
}

function ResultItem({ document, query, onOpen }: ResultItemProps) {
  const plainText = stripHtml(document.content || '');
  const idx = plainText.toLowerCase().indexOf(query.toLowerCase());
  let preview = '';
  if (idx !== -1) {
    const start = Math.max(0, idx - 60);
    const end = Math.min(plainText.length, idx + query.length + 100);
    preview = (start > 0 ? '…' : '') + plainText.slice(start, end) + (end < plainText.length ? '…' : '');
  } else {
    preview = plainText.slice(0, 160) + (plainText.length > 160 ? '…' : '');
  }

  return (
    <div className="search-result-item" onClick={() => onOpen(document.id)}>
      <div className="search-result-icon"><IconDocument /></div>
      <div className="search-result-body">
        <div className="search-result-title" dangerouslySetInnerHTML={{ __html: highlight(document.title || 'Untitled', query) }} />
        <div className="search-result-preview" dangerouslySetInnerHTML={{ __html: highlight(preview, query) }} />
        <div className="search-result-meta">
          <IconClock /> {timeAgo(document.updated_at)}
          {document.pinned ? <span className="search-result-pin">Pinned</span> : null}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const { documents, selectDocument } = useDocumentStore();
  const { setActiveView } = useAppStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim()
    ? documents.filter(d => {
        const q = query.toLowerCase();
        const title = (d.title || '').toLowerCase();
        const content = stripHtml(d.content || '').toLowerCase();
        return title.includes(q) || content.includes(q);
      }).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
    : documents.slice(0, 20).sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());

  const openDocument = (id: string) => {
    selectDocument(id);
    setActiveView('documents');
  };

  return (
    <div className="search-page animate-fade-in">
      <div className="search-page-header">
        <h1 className="search-page-title">Search Documents</h1>
        <p className="search-page-sub">Find anything in your workspace</p>
      </div>

      <div className="search-page-input-wrapper">
        <IconSearch />
        <input
          ref={inputRef}
          type="text"
          className="search-page-input"
          placeholder="Search by title or content..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search documents"
        />
        {query && (
          <button className="btn btn-icon-sm btn-ghost" onClick={() => setQuery('')}>
            <IconX />
          </button>
        )}
      </div>

      <div className="search-page-results">
        {results.length === 0 ? (
          <div className="search-empty">
            <div className="search-empty-icon"><IconSearch /></div>
            <div className="search-empty-title">No results found</div>
            <div className="search-empty-desc">
              {query ? `No documents match "${query}". Try a different search term.` : 'Create some documents to see them here.'}
            </div>
          </div>
        ) : (
          <>
            <div className="search-result-count">
              {results.length} result{results.length !== 1 ? 's' : ''}
              {query ? ` for "${query}"` : ''}
            </div>
            {results.map(doc => (
              <ResultItem key={doc.id} document={doc} query={query} onOpen={openDocument} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}