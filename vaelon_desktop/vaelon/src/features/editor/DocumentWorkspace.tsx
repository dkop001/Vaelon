import { useState, useRef, useCallback } from 'react';
import { useDocumentStore, Document } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';
import { DocumentType } from '../../store/noteStore';
import RichEditor, { RichEditorHandle } from './RichEditor';

// ─── Icons ─────────────────────────────────────────────────────────────────────
const IconUpload      = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 4l3-3 3 3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconImage       = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="4.5" cy="5.5" r="1" fill="currentColor"/><path d="m2 10 3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconPdf         = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 1.5h5.5L12 5v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.2"/><path d="M8.5 1.5V5H12" stroke="currentColor" strokeWidth="1.2"/><path d="M4 7.5h2a1 1 0 0 1 0 2H4v-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>;
const IconTrash       = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.5 3.5h9M5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 6v4M8.5 6v4M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconPin         = () => <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M7.5 1 11 4.5l-2 1-1 4-2.5 1.5L3 8.5 1.5 6 3 3.5l4-1 1-2L7.5 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>;
const IconAI          = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/></svg>;
const IconDocument    = () => <svg width="22" height="22" viewBox="0 0 14 14" fill="none"><rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
const IconSpinner     = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="18 10" strokeLinecap="round"/></svg>;
const IconChevronDown = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2 4 4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconX           = () => <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1 1 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
const IconTag         = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 1h4l5 5-5 5-5-5V2a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>;
const IconExport      = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M1.5 9.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconCode        = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M4 2.5l5 5-5 5M10 2.5l-5 5 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconResearch    = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

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
  documentId: string;
  existingTags: string[];
  onAddTag: (id: string, tag: string) => Promise<void>;
  onRemoveTag: (id: string, tag: string) => Promise<void>;
}

function TagInput({ documentId, existingTags, onAddTag, onRemoveTag }: TagInputProps) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && value.trim()) {
      e.preventDefault();
      onAddTag(documentId, value.trim().replace(/,/g, ''));
      setValue('');
    }
    if (e.key === 'Backspace' && !value && existingTags.length > 0) {
      onRemoveTag(documentId, existingTags[existingTags.length - 1]);
    }
  };

  return (
    <div className="tag-input-wrapper">
      <IconTag />
      {existingTags.map(tag => (
        <span key={tag} className="tag-badge">
          {tag}
          <button className="tag-remove" onClick={() => onRemoveTag(documentId, tag)}><IconX /></button>
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

function ExportMenu({ document, onClose }: { document: Document; onClose: () => void }) {
  const exportAs = (format: 'md' | 'json') => {
    if (format === 'md') {
      const md = `# ${document.title || 'Untitled'}\n\n${stripHtml(document.content || '')}`;
      downloadFile(`${document.title || 'document'}.md`, md, 'text/markdown');
    } else {
      downloadFile(`${document.title || 'document'}.json`, JSON.stringify(document, null, 2), 'application/json');
    }
    onClose();
  };
  return (
    <div className="upload-menu">
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
    <div className="upload-menu">
      <button
        className="upload-menu-item"
        onClick={onImageClick}
        disabled={disabled}
      >
        <span style={{ color: 'var(--accent)' }}><IconImage /></span>
        <div><div>Upload Image</div><div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>OCR text extraction</div></div>
      </button>
      <button
        className="upload-menu-item"
        onClick={onPdfClick}
        disabled={disabled}
      >
        <span style={{ color: 'var(--accent)' }}><IconPdf /></span>
        <div><div>Upload PDF</div><div style={{ fontSize: 10, color: 'var(--tx-tertiary)' }}>Extract all text</div></div>
      </button>
    </div>
  );
}

interface DocumentTypeSelectorProps {
  document: Document;
  onChange: (type: DocumentType) => void;
}

function DocumentTypeSelector({ document, onChange }: DocumentTypeSelectorProps) {
  const types: { value: DocumentType; label: string; icon: React.ReactNode }[] = [
    { value: 'knowledge', label: 'Knowledge', icon: <IconDocument /> },
    { value: 'research', label: 'Research', icon: <IconResearch /> },
    { value: 'code', label: 'Code', icon: <IconCode /> },
    { value: 'task', label: 'Task', icon: <IconTasks /> },
    { value: 'memory', label: 'Memory', icon: <IconMemory /> },
  ];
  return (
    <select
      value={document.type || 'knowledge'}
      onChange={e => onChange(e.target.value as DocumentType)}
      className="document-type-select"
      aria-label="Document type"
    >
      {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

const IconTasks = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M11 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
const IconMemory = () => <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;

// ─── DocumentWorkspace ─────────────────────────────────────────────────────────
interface Props {
  onStatsChange?: (stats: { wordCount: number; charCount: number }) => void;
}

export default function DocumentWorkspace({ onStatsChange }: Props) {
  const { documents, activeDocumentId, updateDocument, deleteDocument, togglePin, addTag, removeTag } = useDocumentStore();
  const { openRightPanel } = useAppStore();

  const activeDocument = documents.find(d => d.id === activeDocumentId) ?? null;

  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);
  const editorRef     = useRef<RichEditorHandle>(null);

  if (!activeDocument) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon"><IconDocument /></div>
        <div className="empty-state-title">No document selected</div>
        <div className="empty-state-desc">Select a document from the sidebar or create a new one to start writing.</div>
      </div>
    );
  }

  const tags: string[] = (() => {
    if (!activeDocument.tags) return [];
    if (Array.isArray(activeDocument.tags)) return activeDocument.tags;
    try { return JSON.parse(activeDocument.tags as unknown as string); } catch { return []; }
  })();

  const handleContentChange = useCallback((htmlContent: string, plainText: string) => {
    updateDocument({ ...activeDocument, content: htmlContent });
    if (onStatsChange) {
      const words = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      onStatsChange({ wordCount: words, charCount: plainText.length });
    }
  }, [activeDocument, updateDocument, onStatsChange]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDocument({ ...activeDocument, title: e.target.value });
  };

  const handleTypeChange = (type: DocumentType) => {
    updateDocument({ ...activeDocument, type });
  };

  const deleteActiveDocument = () => {
    if (window.confirm('Delete this document? This cannot be undone.')) {
      deleteDocument(activeDocument.id);
    }
  };

  // File upload → extract text
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'pdf') => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsExtracting(true);
    setStatusMsg(`Processing "${file.name}"…`);
    setUploadOpen(false);

    try {
      let extracted = '';
      if (type === 'pdf') {
        extracted = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = reader.result as string;
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
        extracted = `[Image attached: ${file.name}]\n[OCR processing requires the Rust OCR extension — coming in a future update]`;
      }

      const append = `<p></p><blockquote><strong>Extracted from ${file.name}:</strong><br/>${extracted.replace(/\n/g, '<br/>')}</blockquote><p></p>`;
      updateDocument({ ...activeDocument, content: (activeDocument.content || '') + append });
      setStatusMsg('');
    } catch (err: any) {
      setStatusMsg(err.message || 'Failed to process file.');
    } finally {
      setIsExtracting(false);
      event.target.value = '';
    }
  };

  const updatedLabel = activeDocument.updated_at
    ? new Date(activeDocument.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="note-workspace animate-fade-in">
      <div className="note-editor-card">
        <div className="note-editor-header">
          <input
            className="note-title-input"
            value={activeDocument.title || ''}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
            aria-label="Document title"
            id="document-title-input"
          />

          <div className="note-header-actions">
            {isExtracting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 'var(--text-xs)' }}>
                <IconSpinner /><span>Processing...</span>
              </div>
            )}

            <DocumentTypeSelector document={activeDocument} onChange={handleTypeChange} />

            <button
              className={`btn btn-sm ${activeDocument.pinned ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => togglePin(activeDocument.id)}
              title={activeDocument.pinned ? 'Unpin document' : 'Pin document'}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <IconPin /> {activeDocument.pinned ? 'Pinned' : 'Pin'}
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
                title="Export document"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <IconExport /> Export
              </button>
              {exportOpen && <ExportMenu document={activeDocument} onClose={() => setExportOpen(false)} />}
            </div>

            <button
              className="btn btn-sm btn-ghost"
              onClick={deleteActiveDocument}
              title="Delete document"
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
          <TagInput documentId={activeDocument.id} existingTags={tags} onAddTag={addTag} onRemoveTag={removeTag} />
        </div>

        {statusMsg && (
          <div style={{ padding: '8px 20px', background: 'var(--accent-muted)', borderBottom: '1px solid var(--accent-border)', color: 'var(--accent)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconSpinner /> {statusMsg}
          </div>
        )}

        <RichEditor
          ref={editorRef}
          content={activeDocument.content || ''}
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
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}