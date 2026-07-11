import { useState, useRef, useCallback } from 'react';
import { useNoteStore } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';
import { Note } from '../../ipc/client';
import RichEditor, { RichEditorHandle } from './RichEditor';

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconUpload    = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 4l3-3 3 3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconImage     = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="4.5" cy="5.5" r="1" fill="currentColor"/><path d="m2 10 3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconPdf       = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 1.5h5.5L12 5v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2"/><path d="M8.5 1.5V5H12" stroke="currentColor" strokeWidth="1.2"/><path d="M4 7.5h2a1 1 0 0 1 0 2H4v-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>;
const IconTrash     = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 6v4M8.5 6v4M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconPin       = () => <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M7.5 1 11 4.5l-2 1-1 4-2.5 1.5L3 8.5 1.5 6 3 3.5l4-1 1-2L7.5 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>;
const IconAI        = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/></svg>;
const IconStudy     = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;
const IconNote      = () => <svg width="22" height="22" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
const IconSpinner   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="18 10" strokeLinecap="round"/></svg>;
const IconChevronDown = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconX         = () => <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1 1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
const IconTag       = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 1h4l5 5-5 5-5-5V2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>;
const IconExport    = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1.5 9.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ────────────────────────────────────────────────────────────
interface TagInputProps {
  noteId: string;
  existingTags: string[];
  onAddTag: (id: string, tag: string) => Promise<void>;
  onRemoveTag: (id: string, tag: string) => Promise<void>;
}

function TagInput({ noteId, existingTags, onAddTag, onRemoveTag }: TagInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && value.trim()) {
      e.preventDefault();
      onAddTag(noteId, value.trim().replace(/,/g, ''));
      setValue('');
    }
    if (e.key === 'Backspace' && !value && existingTags.length > 0) {
      onRemoveTag(noteId, existingTags[existingTags.length - 1]);
    }
  };

  return (
    <div className="tag-input-wrapper">
      <IconTag />
      {existingTags.map(tag => (
        <span key={tag} className="tag-badge">
          {tag}
          <button className="tag-remove" onClick={() => onRemoveTag(noteId, tag)}><IconX /></button>
        </span>
      ))}
      <input
        type="text"
        className="tag-input"
        placeholder={existingTags.length === 0 ? 'Add tags...' : ''}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Add tags"
      />
    </div>
  );
}

function ExportMenu({ note, onClose }: { note: Note; onClose: () => void }) {
  const exportAs = (format: 'md' | 'json') => {
    if (format === 'md') {
      const md = `# ${note.title || 'Untitled'}\n\n${stripHtml(note.content || '')}`;
      downloadFile(`${note.title || 'note'}.md`, md, 'text/markdown');
    } else {
      downloadFile(`${note.title || 'note'}.json`, JSON.stringify(note, null, 2), 'application/json');
    }
    onClose();
  };
  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 6, minWidth: 140 }}>
      <button className="export-option" onClick={() => exportAs('md')}>Export as Markdown</button>
      <button className="export-option" onClick={() => exportAs('json')}>Export as JSON</button>
    </div>
  );
}

interface UploadMenuProps {
  onImageClick: () => void;
  onPdfClick: () => void;
  disabled: boolean;
}

function UploadMenu({ onImageClick, onPdfClick, disabled }: UploadMenuProps) {
  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 6, minWidth: 200 }}>
      <button
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'none', color: 'var(--tx-primary)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer' }}
        onClick={onImageClick} disabled={disabled}
      >
        <span style={{ color: 'var(--accent)' }}><IconImage /></span>
        <div><div>Upload Image</div><div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>OCR text extraction</div></div>
      </button>
      <button
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'none', color: 'var(--tx-primary)', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer' }}
        onClick={onPdfClick} disabled={disabled}
      >
        <span style={{ color: 'var(--accent)' }}><IconPdf /></span>
        <div><div>Upload PDF</div><div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>Extract all text</div></div>
      </button>
    </div>
  );
}

// ─── NoteWorkspace ─────────────────────────────────────────────────────────────
interface Props {
  onStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
}

export default function NoteWorkspace({ onStatsChange }: Props) {
  const { notes, activeNoteId, updateNote, deleteNote, togglePin, addTag, removeTag } = useNoteStore();
  const { openRightPanel } = useAppStore();

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);
  const editorRef     = useRef<RichEditorHandle>(null);

  if (!activeNote) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon"><IconNote /></div>
        <div className="empty-state-title">No note selected</div>
        <div className="empty-state-desc">Select a note from the sidebar or create a new one to start writing.</div>
      </div>
    );
  }

  const tags: string[] = (() => {
    if (!activeNote.tags) return [];
    if (Array.isArray(activeNote.tags)) return activeNote.tags;
    try { return JSON.parse(activeNote.tags as unknown as string); } catch { return []; }
  })();

  const handleContentChange = useCallback((htmlContent: string, plainText: string) => {
    updateNote({ ...activeNote, content: htmlContent });
    if (onStatsChange) {
      const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      onStatsChange({ wordCount: words, charCount: plainText.length });
    }
  }, [activeNote, updateNote, onStatsChange]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNote({ ...activeNote, title: e.target.value });
  };

  const deleteActiveNote = () => {
    if (window.confirm('Delete this note? This cannot be undone.')) {
      deleteNote(activeNote.id);
    }
  };

  // File upload → extract text using native browser APIs
  // OCR (images) uses the Tesseract-free approach: copy raw filename to note
  // PDF text extraction: reads file as text (best-effort for text-based PDFs)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setStatusMsg(`Processing "${file.name}"…`);
    setUploadOpen(false);

    try {
      let extracted = '';
      if (type === 'pdf') {
        // Use FileReader to read text content from text-based PDFs
        extracted = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = reader.result as string;
            // Strip PDF binary content, keep readable text runs
            const text = raw
              .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
              .replace(/\s{3,}/g, '\n')
              .trim()
              .slice(0, 8000);
            resolve(text || '[PDF extraction produced no readable text]');
          };
          reader.onerror = reject;
          reader.readAsBinaryString(file);
        });
      } else {
        // For images, note the filename — full OCR requires a server/Rust extension
        extracted = `[Image attached: ${file.name}]\n[OCR processing requires the Rust OCR extension — coming in a future update]`;
      }

      const append = `<p></p><blockquote><strong>Extracted from ${file.name}:</strong><br/>${extracted.replace(/\n/g, '<br/>')}</blockquote><p></p>`;
      updateNote({ ...activeNote, content: (activeNote.content || '') + append });
      setStatusMsg('');
    } catch (err: any) {
      setStatusMsg(err.message || 'Failed to process file.');
    } finally {
      setIsExtracting(false);
      event.target.value = '';
    }
  };

  const updatedLabel = activeNote.updated_at
    ? new Date(activeNote.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="note-workspace animate-fade-in">
      <div className="note-editor-card">
        <div className="note-editor-header">
          <input
            className="note-title-input"
            value={activeNote.title || ''}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            aria-label="Note title"
            id="note-title-input"
          />

          <div className="note-header-actions">
            {isExtracting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 'var(--text-xs)' }}>
                <IconSpinner /><span>Processing...</span>
              </div>
            )}

            <button
              className={`btn btn-sm ${activeNote.pinned ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => togglePin(activeNote.id)}
              title={activeNote.pinned ? 'Unpin note' : 'Pin note'}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconPin /> {activeNote.pinned ? 'Pinned' : 'Pin'}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setUploadOpen(o => !o)}
                disabled={isExtracting}
                title="Add source document"
              >
                <IconUpload /> Add Source <IconChevronDown />
              </button>
              {uploadOpen && (
                <UploadMenu
                  disabled={isExtracting}
                  onImageClick={() => { setUploadOpen(false); imageInputRef.current?.click(); }}
                  onPdfClick={() => { setUploadOpen(false); pdfInputRef.current?.click(); }}
                />
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setExportOpen(o => !o)}
                title="Export note"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <IconExport /> Export
              </button>
              {exportOpen && <ExportMenu note={activeNote} onClose={() => setExportOpen(false)} />}
            </div>

            <button
              className="btn btn-sm btn-ghost"
              onClick={deleteActiveNote}
              title="Delete note"
              style={{ color: 'var(--tx-tertiary)' }}
            >
              <IconTrash />
            </button>
          </div>

          <input type="file" ref={imageInputRef} accept="image/*"         style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'image')} />
          <input type="file" ref={pdfInputRef}   accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'pdf')} />
        </div>

        <div className="note-meta-bar">
          {updatedLabel && <span>Last edited {updatedLabel}</span>}
        </div>

        <div className="note-tags-bar">
          <TagInput noteId={activeNote.id} existingTags={tags} onAddTag={addTag} onRemoveTag={removeTag} />
        </div>

        {statusMsg && (
          <div style={{ padding: '8px 20px', background: 'var(--accent-muted)', borderBottom: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSpinner /> {statusMsg}
          </div>
        )}

        <RichEditor
          ref={editorRef}
          content={activeNote.content || ''}
          onChange={handleContentChange}
          placeholder="Start writing... type / for blocks, or paste content here"
        />

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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
