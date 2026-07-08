import { useState, useRef, useCallback } from 'react';
import { useNoteStore } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';
import { extractTextFromImage, getImageConfidence } from '../../lib/ocr';
import { extractTextFromPdf } from '../../lib/pdf';
import RichEditor from './RichEditor';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconUpload = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1v8M4 4l3-3 3 3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconImage = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="4.5" cy="5.5" r="1" fill="currentColor"/>
    <path d="m2 10 3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPdf = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M3 1.5h5.5L12 5v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M8.5 1.5V5H12" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4 7.5h2a1 1 0 0 1 0 2H4v-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 3.5h9M5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 6v4M8.5 6v4M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
  </svg>
);
const IconStudy = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconNote = () => (
  <svg width="22" height="22" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="18 10" strokeLinecap="round"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconX = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M1 1l9 9M10 1 1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// ── Confidence badge ───────────────────────────────────────────────────────────
function ConfidenceBadge({ level }) {
  const map = {
    high:   { bg: 'var(--success-muted)', color: 'var(--success)', label: 'OCR: High' },
    medium: { bg: 'var(--warning-muted)', color: 'var(--warning)', label: 'OCR: Medium' },
    low:    { bg: 'var(--danger-muted)',  color: 'var(--danger)',  label: 'OCR: Low' },
  };
  const s = map[level] ?? map.medium;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-full)',
      background: s.bg, color: s.color, letterSpacing: '.03em',
    }}>
      {s.label}
    </span>
  );
}

// ── Upload dropdown ────────────────────────────────────────────────────────────
function UploadMenu({ onImageClick, onPdfClick, onClose, disabled }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
      padding: 6, minWidth: 200, animation: 'slide-up-in .15s ease',
    }}>
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
          background: 'none', color: 'var(--tx-primary)', fontSize: 'var(--text-sm)',
          fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--t-fast)',
        }}
        onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={onImageClick}
        disabled={disabled}
      >
        <span style={{ color: 'var(--accent)' }}><IconImage /></span>
        <div>
          <div>Upload Image</div>
          <div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>OCR text extraction</div>
        </div>
      </button>
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
          background: 'none', color: 'var(--tx-primary)', fontSize: 'var(--text-sm)',
          fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--t-fast)',
        }}
        onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'var(--bg-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        onClick={onPdfClick}
        disabled={disabled}
      >
        <span style={{ color: 'var(--accent-3)' }}><IconPdf /></span>
        <div>
          <div>Upload PDF</div>
          <div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>Extract all text</div>
        </div>
      </button>
    </div>
  );
}

// ── NoteWorkspace ──────────────────────────────────────────────────────────────
export default function NoteWorkspace({ onStatsChange }) {
  const { getActiveNote, updateNote, deleteNote } = useNoteStore();
  const { openRightPanel } = useAppStore();

  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState('');

  const imageInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const editorRef = useRef(null);

  const activeNote = getActiveNote();

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!activeNote) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon">
          <IconNote />
        </div>
        <div className="empty-state-title">No note selected</div>
        <div className="empty-state-desc">
          Select a note from the sidebar or create a new one to start writing.
        </div>
      </div>
    );
  }

  const handleContentChange = useCallback((htmlContent, plainText) => {
    updateNote(activeNote.id, { content: htmlContent });
    if (onStatsChange) {
      const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      onStatsChange({ wordCount: words, charCount: plainText.length });
    }
  }, [activeNote.id, updateNote, onStatsChange]);

  const handleTitleChange = (e) => {
    updateNote(activeNote.id, { title: e.target.value });
  };

  const deleteActiveNote = () => {
    if (window.confirm('Delete this note? This cannot be undone.')) {
      deleteNote(activeNote.id);
    }
  };

  const handleFileUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setStatusMsg(`Extracting text from "${file.name}"…`);
    setOcrConfidence('');
    setUploadOpen(false);
    try {
      let extracted = '';
      if (type === 'image') {
        extracted = await extractTextFromImage(file);
        try {
          const conf = await getImageConfidence(file);
          setOcrConfidence(conf);
        } catch { /* ignored */ }
      } else {
        extracted = await extractTextFromPdf(file);
      }
      const currentHTML = activeNote.content || '';
      const append = `<p></p><blockquote><strong>Extracted from ${file.name}:</strong><br/>${extracted.replace(/\n/g, '<br/>')}</blockquote><p></p>`;
      updateNote(activeNote.id, { content: currentHTML + append, sourceFile: { name: file.name, type } });
      setStatusMsg('');
    } catch (err) {
      setStatusMsg(err.message || 'Failed to extract text from file.');
    } finally {
      setIsExtracting(false);
      event.target.value = '';
    }
  };

  // Format timestamp
  const updatedLabel = activeNote.updatedAt
    ? new Date(activeNote.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="note-workspace animate-fade-in">
      {/* ── Note editor card ── */}
      <div className="note-editor-card">

        {/* Header */}
        <div className="note-editor-header">
          {/* Title input */}
          <input
            className="note-title-input"
            value={activeNote.title || ''}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            aria-label="Note title"
            id="note-title-input"
          />

          {/* Right actions */}
          <div className="note-header-actions">
            {isExtracting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 'var(--text-xs)' }}>
                <IconSpinner />
                <span>Extracting…</span>
              </div>
            )}

            {ocrConfidence && <ConfidenceBadge level={ocrConfidence} />}

            {/* Upload button */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setUploadOpen(o => !o)}
                disabled={isExtracting}
                title="Add source document"
                aria-label="Upload document"
                id="note-upload-btn"
              >
                <IconUpload />
                Add Source
                <IconChevronDown />
              </button>
              {uploadOpen && (
                <UploadMenu
                  disabled={isExtracting}
                  onClose={() => setUploadOpen(false)}
                  onImageClick={() => { setUploadOpen(false); imageInputRef.current?.click(); }}
                  onPdfClick={() => { setUploadOpen(false); pdfInputRef.current?.click(); }}
                />
              )}
            </div>

            {/* Delete */}
            <button
              className="btn btn-sm btn-ghost"
              onClick={deleteActiveNote}
              title="Delete note"
              aria-label="Delete note"
              id="note-delete-btn"
              style={{ color: 'var(--tx-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--danger-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <IconTrash />
            </button>
          </div>

          {/* Hidden file inputs */}
          <input type="file" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'image')} />
          <input type="file" ref={pdfInputRef} accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'pdf')} />
        </div>

        {/* Note metadata bar */}
        <div className="note-meta-bar">
          {updatedLabel && <span>Last edited {updatedLabel}</span>}
          {activeNote.sourceFile && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '1px 8px', borderRadius: 'var(--radius-full)',
              background: 'var(--accent-muted)', color: 'var(--accent)',
              fontSize: 10, fontWeight: 600,
            }}>
              📄 {activeNote.sourceFile.name}
              <button
                onClick={() => updateNote(activeNote.id, { sourceFile: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0, marginLeft: 2 }}
                title="Remove source"
              >
                <IconX />
              </button>
            </span>
          )}
        </div>

        {/* Status message */}
        {statusMsg && (
          <div style={{
            padding: '8px 20px', background: 'var(--accent-muted)',
            borderBottom: '1px solid var(--accent-border)',
            color: 'var(--accent)', fontSize: 'var(--text-xs)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <IconSpinner /> {statusMsg}
          </div>
        )}

        {/* Rich Editor */}
        <RichEditor
          ref={editorRef}
          content={activeNote.content || ''}
          onChange={handleContentChange}
          placeholder="Start writing… type / for blocks, or paste content here"
        />

        {/* Footer CTA bar */}
        <div className="note-editor-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => openRightPanel('summary')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconAI /> AI Summary
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openRightPanel('quiz')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <IconStudy /> Study Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
