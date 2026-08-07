import React, { useState, useRef, useCallback } from 'react';
import { Copy, Download, BrainCircuit, Check, Loader2, PlayCircle, Headphones, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ChatPanel from './ChatPanel';

const SummaryResult = ({ summary, onGenerateQuiz, isGeneratingQuiz, hasQuiz, isStreaming, userId, noteId, noteText }) => {
  const [copied, setCopied] = useState(false);
  const [audioState, setAudioState] = useState({ blob: null, url: null, isPlaying: false, isLoading: false, isPaused: false });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const generateNoteTitle = (text) => {
    const lines = text.split('\n');
    const titleLine = lines.find(l => l.startsWith('# '));
    return titleLine ? titleLine.slice(2).trim() : 'Untitled';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    const title = generateNoteTitle(summary);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Summary_${date}.pdf`;

    const { pdf } = await import('@react-pdf/renderer');
    const { default: SummaryPdf } = await import('./SummaryPdf');
    const blob = await pdf(<SummaryPdf summary={summary} title={title} />).toBlob();
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    element.href = url;
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const handleTts = useCallback(async () => {
    // TTS requires a server-side service. In local mode, this feature is not available.
    alert('Text-to-speech requires a server-side TTS service and is not available in local mode.');
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = playbackSpeed;
      // Auto-play when audio is freshly loaded
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleSkip = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    }
  };

  const handleSpeedChange = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleAudioEnded = () => {
    setAudioState(prev => ({ ...prev, isPlaying: false, isPaused: false }));
  };

  const handleNativePlay = () => setAudioState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
  const handleNativePause = () => setAudioState(prev => ({ ...prev, isPlaying: false, isPaused: true }));

  if (!summary) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-card summary-card"
      style={{
        width: '100%',
        maxWidth: '800px',
        margin: '1.5rem auto 0',
        backgroundColor: 'var(--bg-tertiary)',
        borderLeft: '4px solid var(--accent-primary)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 700,
          color: 'var(--accent-primary)',
          flexShrink: 0,
        }}>
          AI Summary
        </h2>
        <div className="summary-actions" style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '36px', minWidth: '36px', transition: 'var(--transition)',
            }}
          >
            {copied ? <Check size={17} color="var(--accent-primary)" /> : <Copy size={17} />}
          </button>
          <button
            onClick={handleDownloadPdf}
            title="Download as PDF"
            disabled={isStreaming}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '36px', minWidth: '36px', transition: 'var(--transition)',
              opacity: isStreaming ? 0.5 : 1,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={17} />
          </button>
          <button
            onClick={handleTts}
            disabled={isStreaming || audioState.isLoading}
            title={audioState.isPlaying ? 'Pause' : 'Listen'}
            style={{
              padding: '0.5rem', borderRadius: 'var(--radius-sm)',
              backgroundColor: audioState.isPlaying ? 'hsla(262,80%,60%,0.12)' : 'var(--bg-secondary)',
              color: audioState.isPlaying ? 'var(--accent-primary)' : 'var(--text-secondary)',
              border: audioState.isPlaying ? '1px solid hsla(262,80%,60%,0.3)' : '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: '36px', minWidth: '36px', transition: 'var(--transition)',
              opacity: isStreaming ? 0.5 : 1,
              cursor: isStreaming ? 'not-allowed' : 'pointer',
            }}
          >
            {audioState.isLoading ? (
              <Loader2 size={17} className="animate-spin" />
            ) : audioState.isPlaying ? (
              <Pause size={17} />
            ) : (
              <Headphones size={17} />
            )}
          </button>
        </div>
      </div>

      {/* Summary text */}
      <div style={{
        fontSize: '0.9375rem',
        lineHeight: '1.8',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}>
        {summary}
        {isStreaming && <span className="streaming-cursor" />}
      </div>

      {/* Audio player */}
      {audioState.url && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
        }}>
          <audio
            ref={audioRef}
            src={audioState.url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            onPlay={handleNativePlay}
            onPause={handleNativePause}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => handleSkip(-15)}
              style={{
                padding: '0.375rem', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: '32px', minWidth: '32px',
              }}
              className="hover-bg"
              title="Skip back 15s"
            >
              <SkipBack size={15} />
            </button>

            <button
              onClick={handleTts}
              style={{
                width: '40px', height: '40px', minWidth: '40px', minHeight: '40px',
                borderRadius: '50%',
                backgroundColor: audioState.isPlaying ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: audioState.isPlaying ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {audioState.isPlaying ? <Pause size={17} /> : <PlayCircle size={17} />}
            </button>

            <button
              onClick={() => handleSkip(15)}
              style={{
                padding: '0.375rem', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: '32px', minWidth: '32px',
              }}
              className="hover-bg"
              title="Skip forward 15s"
            >
              <SkipForward size={15} />
            </button>

            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              style={{
                flex: 1,
                height: '4px',
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
              }}
            />

            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', minWidth: '70px', textAlign: 'right' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <button
              onClick={handleSpeedChange}
              style={{
                padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--accent-primary)', backgroundColor: 'hsla(262,80%,60%,0.08)',
                border: '1px solid hsla(262,80%,60%,0.2)',
                minHeight: 'auto', minWidth: 'auto',
              }}
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>

            <a
              href={audioState.url}
              download="summary_audio.mp3"
              style={{
                padding: '0.375rem', borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                minHeight: '32px', minWidth: '32px',
                textDecoration: 'none',
              }}
              className="hover-bg"
              title="Download MP3"
            >
              <Download size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Generate Quiz button */}
      <div className="summary-quiz-action" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <button
          className="btn-primary"
          onClick={() => onGenerateQuiz(summary)}
          disabled={isGeneratingQuiz}
          style={{
            background: 'none',
            border: '2px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            boxShadow: 'none',
            width: '100%',
            maxWidth: '280px',
            opacity: isGeneratingQuiz ? 0.7 : 1,
            cursor: isGeneratingQuiz ? 'not-allowed' : 'pointer',
          }}
        >
          {isGeneratingQuiz ? (
            <>
              <Loader2 size={17} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Generating Quiz...
            </>
          ) : hasQuiz ? (
            <>
              <PlayCircle size={17} />
              Play Quiz Again
            </>
          ) : (
            <>
              <BrainCircuit size={17} />
              Generate Quiz
            </>
          )}
        </button>
      </div>

      {/* Chat Panel — follow-up Q&A */}
      <ChatPanel
        summary={summary}
        noteText={noteText}
        userId={userId}
        noteId={noteId}
      />
    </motion.div>
  );
};

export default SummaryResult;
