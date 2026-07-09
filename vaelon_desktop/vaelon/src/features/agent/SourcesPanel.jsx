import { useState } from 'react';

export default function SourcesPanel({ sources }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-panel">
      <button
        className="sources-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="sources-list">
          {sources.map((source, i) => (
            <div key={i} className="source-item">
              <div className="source-header">
                <span className="source-title">{source.noteTitle}</span>
                <span className="source-score">
                  {(source.score * 100).toFixed(0)}% match
                </span>
              </div>
              <p className="source-preview">{source.text}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
