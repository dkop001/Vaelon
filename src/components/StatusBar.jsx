export default function StatusBar({ wordCount, charCount, isStreaming, isAuthenticated, editorMode }) {
  return (
    <div className="statusbar">
      <div className="statusbar-section">
        <div className="statusbar-indicator">
          <span className={`statusbar-dot ${isStreaming ? 'processing' : 'connected'}`} />
          <span>{isStreaming ? 'Processing' : 'Ready'}</span>
        </div>
      </div>
      <div className="statusbar-spacer" />
      <div className="statusbar-section">
        {wordCount !== undefined && (
          <span>{wordCount} words</span>
        )}
        {charCount !== undefined && (
          <span>{charCount} chars</span>
        )}
        {editorMode && (
          <span>{editorMode === 'rich' ? 'Rich Text' : 'Plain Text'}</span>
        )}
        <span>{isAuthenticated ? 'Connected' : 'Offline'}</span>
      </div>
    </div>
  );
}
