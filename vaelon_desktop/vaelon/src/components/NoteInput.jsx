import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, Image as ImageIcon, Plus, Send, Trash2, Type, Edit3 } from 'lucide-react';
import { extractTextFromImage, getImageConfidence } from '../lib/ocr';
import { extractTextFromPdf } from '../lib/pdf';
import RichEditor from './RichEditor';

const emptySource = { name: '', text: '', type: '' };

const NoteInput = ({
  text,
  onTextChange,
  uploadedSource = emptySource,
  onUploadedSourceChange,
  onFileLoaded,
  onSummarize,
  isLoading,
  onClear,
  editorMode,
  onEditorModeChange,
  onboardingStep,
}) => {
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [fileStatus, setFileStatus] = useState('');
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const [imageConfidence, setImageConfidence] = useState('');
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const textareaRef = useRef(null);
  const richEditorRef = useRef(null);

  const editorModeKey = 'noteai-editor-mode';

  useEffect(() => {
    const saved = localStorage.getItem(editorModeKey);
    if (saved && onEditorModeChange) {
      onEditorModeChange(saved);
    }
  }, []);

  const handleModeToggle = () => {
    const next = editorMode === 'rich' ? 'simple' : 'rich';
    localStorage.setItem(editorModeKey, next);
    if (onEditorModeChange) onEditorModeChange(next);
  };

  const getEditorText = useCallback(() => {
    return richEditorRef.current?.getPlainText() || '';
  }, []);

  useEffect(() => {
    let timeoutId;
    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const maxH = window.innerWidth < 640 ? 150 : 220;
      el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
      el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
    };

    if (document.body.classList.contains('is-mobile')) {
      timeoutId = setTimeout(resize, 100);
    } else {
      resize();
    }
    return () => clearTimeout(timeoutId);
  }, [text]);

  const sourceName = uploadedSource.name || '';
  const sourceText = uploadedSource.text || '';
  const sourceType = uploadedSource.type || '';

  const clearUploadedSource = () => {
    if (onUploadedSourceChange) {
      onUploadedSourceChange(emptySource);
    }
  };

  const handleSummarize = () => {
    const content = editorMode === 'rich' ? getEditorText() : text;
    if (content.trim()) {
      onSummarize(content);
    }
  };

  const clearText = () => {
    onTextChange('');
    if (onClear) onClear();
    setFileStatus('');
    setImageConfidence('');
    clearUploadedSource();
  };

  const handleTextChange = (event) => {
    setFileStatus('');
    onTextChange(event.target.value);
  };

  const handleSourceSummarize = () => {
    if (sourceText.trim()) {
      onSummarize(sourceText);
    }
  };

  const handleExtractedFile = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const label = type === 'image' ? 'image' : 'PDF';

    setIsExtractingFile(true);
    setFileStatus(`Extracting text from ${file.name}...`);
    clearUploadedSource();

    try {
      const extractedText = type === 'image'
        ? await extractTextFromImage(file)
        : await extractTextFromPdf(file);

      onTextChange('');
      if (onFileLoaded) {
        onFileLoaded({
          name: file.name,
          text: extractedText,
          type,
        });
      }

      if (type === 'image') {
        try {
          const conf = await getImageConfidence(file);
          setImageConfidence(conf);
        } catch {}
      }

      setFileStatus('');
      setIsUploadMenuOpen(false);
    } catch (error) {
      setFileStatus(error.message || `Failed to extract text from the ${label}.`);
    } finally {
      setIsExtractingFile(false);
      event.target.value = '';
    }
  };

  const isBusy = isLoading || isExtractingFile;

  const confidenceBadge = (conf) => {
    const colors = {
      high: { bg: 'hsla(142,71%,45%,0.1)', color: 'hsl(142,71%,45%)' },
      medium: { bg: 'hsla(40,90%,55%,0.1)', color: 'hsl(38,90%,45%)' },
      low: { bg: 'hsla(0,84%,60%,0.1)', color: 'hsl(0,84%,60%)' },
    };
    const c = colors[conf] || colors.medium;
    return (
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '0.15rem 0.45rem',
        borderRadius: 'var(--radius-full)',
        backgroundColor: c.bg,
        color: c.color,
        textTransform: 'uppercase',
      }}>
        {conf}
      </span>
    );
  };

  return (
    <div className="premium-card note-card animate-fade-in" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header row */}
      <div className="note-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.875rem',
        gap: '0.5rem',
      }}>
        <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, flexShrink: 0 }}>
          Paste your notes
        </h2>
        <div className="note-header-tools" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
          {/* Editor mode toggle */}
          <button
            type="button"
            onClick={handleModeToggle}
            title={editorMode === 'rich' ? 'Switch to Simple mode' : 'Switch to Rich editor'}
            style={{
              width: '34px',
              height: '34px',
              minWidth: '34px',
              minHeight: '34px',
              borderRadius: 'var(--radius-md)',
              color: editorMode === 'rich' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              border: '1px solid',
              borderColor: editorMode === 'rich' ? 'hsla(262,80%,60%,0.3)' : 'var(--border-color)',
              backgroundColor: editorMode === 'rich' ? 'hsla(262,80%,60%,0.08)' : 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
            }}
          >
            {editorMode === 'rich' ? <Edit3 size={16} /> : <Type size={16} />}
          </button>

          <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {text.length} chars
          </span>
          <button
            type="button"
            onClick={() => setIsUploadMenuOpen((open) => !open)}
            disabled={isBusy}
            title="Add notes from file"
            aria-label="Add notes from file"
            style={{
              width: '34px',
              height: '34px',
              minWidth: '34px',
              minHeight: '34px',
              borderRadius: 'var(--radius-md)',
              color: 'var(--accent-primary)',
              border: '1px solid hsla(262, 80%, 60%, 0.24)',
              backgroundColor: 'hsla(262, 80%, 60%, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)',
              opacity: isBusy ? 0.6 : 1,
            }}
          >
            {isExtractingFile ? (
              <div style={{
                width: '16px', height: '16px',
                border: '2px solid hsla(262, 80%, 60%, 0.25)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : <Plus size={19} />}
          </button>

          {isUploadMenuOpen && (
            <div className="upload-menu" style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: 0,
              zIndex: 20,
              width: '210px',
              padding: '0.375rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              boxShadow: 'var(--shadow-lg)',
            }}>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isBusy}
                style={{
                  width: '100%', minHeight: '44px', padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  fontSize: '0.875rem', fontWeight: 600, textAlign: 'left',
                }}
                className="hover-bg"
              >
                <FileText size={17} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isBusy}
                style={{
                  width: '100%', minHeight: '44px', padding: '0.625rem 0.75rem',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  fontSize: '0.875rem', fontWeight: 600, textAlign: 'left',
                }}
                className="hover-bg"
              >
                <ImageIcon size={17} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                Upload Image
              </button>
            </div>
          )}
        </div>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          onChange={(event) => handleExtractedFile(event, 'pdf')}
          style={{ display: 'none' }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp,image/heic,image/heif,.heic,.heif"
          onChange={(event) => handleExtractedFile(event, 'image')}
          style={{ display: 'none' }}
        />
      </div>

      {fileStatus && (
        <div style={{
          margin: '-0.25rem 0 0.75rem',
          color: 'var(--text-tertiary)',
          fontSize: '0.8125rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {fileStatus}
        </div>
      )}

      {sourceName && (
        <div className="file-ready-row" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem',
          marginBottom: '0.875rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
            {sourceType === 'image' ? (
              <ImageIcon size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            ) : (
              <FileText size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            )}
            <span style={{
              color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {sourceName}
            </span>
            {imageConfidence && confidenceBadge(imageConfidence)}
          </div>
          <button
            type="button"
            className="file-summarize-btn"
            onClick={handleSourceSummarize}
            disabled={isBusy || !sourceText}
            style={{
              padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)',
              color: 'var(--accent-primary)', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.375rem', fontSize: '0.875rem',
              border: '1px solid hsla(262, 80%, 60%, 0.25)',
              backgroundColor: 'hsla(262, 80%, 60%, 0.08)',
              opacity: isBusy ? 0.6 : 1, whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {isLoading ? (
              <div style={{
                width: '15px', height: '15px',
                border: '2px solid hsla(262, 80%, 60%, 0.25)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
            ) : <Send size={15} />}
            Summarize
          </button>
        </div>
      )}

      {editorMode === 'rich' ? (
        <RichEditor
          ref={richEditorRef}
          content={text}
          onChange={onTextChange}
          placeholder="Drop your messy lecture notes, meeting transcripts, or thoughts here..."
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="input-premium chatgpt-textarea"
          style={{
            resize: 'none', lineHeight: '1.6', marginBottom: '1.25rem',
            minHeight: '52px', height: '52px', overflowY: 'hidden',
            transition: 'height 0.1s ease',
          }}
          placeholder="Drop your messy lecture notes, meeting transcripts, or thoughts here..."
          value={text}
          onChange={handleTextChange}
          disabled={isBusy}
        />
      )}

      {/* Action buttons */}
      <div className="note-actions" style={{
        display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap',
      }}>
        <button
          onClick={clearText}
          disabled={isBusy || (!text && !sourceName)}
          style={{
            padding: '0.625rem 1rem', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            transition: 'var(--transition)', fontSize: '0.9375rem',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            minHeight: '44px',
            opacity: (!text && !sourceName) || isBusy ? 0.4 : 1,
            justifyContent: 'center',
          }}
        >
          <Trash2 size={16} />
          Clear
        </button>

        <button
          className={`btn-primary${onboardingStep === 3 ? ' pulse-button' : ''}`}
          onClick={handleSummarize}
          disabled={isBusy || !text}
        >
          {isExtractingFile ? (
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              Extracting<span className="typing-dots"></span>
            </span>
          ) : isLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              Summarizing<span className="typing-dots"></span>
            </span>
          ) : (
            <>
              <Send size={17} />
              Summarize
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        textarea.chatgpt-textarea {
          max-height: 150px;
          overflow-y: hidden;
          box-sizing: border-box;
        }
        @media (min-width: 640px) {
          textarea.chatgpt-textarea {
            max-height: 220px;
          }
        }
      `}</style>
    </div>
  );
};

export default NoteInput;
