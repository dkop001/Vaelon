import { useState } from 'react';
import { useNoteStore } from '../../store/noteStore';
import { useAppStore } from '../../store/appStore';
import { generateQuiz } from '../../lib/aiRouter';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconGrad = () => (
  <svg width="24" height="24" viewBox="0 0 14 14" fill="none">
    <path d="M7 1.5 13 4.5 7 7.5 1 4.5l6-3Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    <path d="M3.5 5.5v4a5 5 0 0 0 7 0v-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7.5 5 10l6.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
    <path d="m2.5 2.5 9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconAI = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" fill="currentColor"/>
  </svg>
);
const IconSpinner = () => (
  <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="18 10" strokeLinecap="round"/>
  </svg>
);
const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconNote = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);
const IconTrophy = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4M18 9h2a2 2 0 0 0 2-2V5h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 5h12v5a6 6 0 0 1-12 0V5Z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 16v3M9 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

// ── Quiz Session ──────────────────────────────────────────────────────────────
interface QuizSessionProps {
  questions: Question[];
  onFinished: () => void;
}

function QuizSession({ questions, onFinished }: QuizSessionProps) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[idx];
  const progress = ((idx + (answered ? 1 : 0)) / questions.length) * 100;

  const handleSelect = (optIdx: number) => {
    if (answered) return;
    setSelected(optIdx);
    setAnswered(true);
    if (optIdx === q.correctAnswerIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (idx < questions.length - 1) {
      setIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setDone(true);
    }
  };

  const restart = () => {
    setIdx(0); setSelected(null); setAnswered(false); setScore(0); setDone(false);
  };

  const pct = Math.round((score / questions.length) * 100);
  const grade = pct >= 80 ? { label: 'Excellent!', color: 'var(--success)' } :
                pct >= 60 ? { label: 'Good job!',  color: 'var(--warning)' } :
                            { label: 'Keep going!', color: 'var(--accent-3)' };

  // ── Results screen ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="study-quiz-card animate-fade-in" style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-8)' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto var(--sp-6)',
          background: 'var(--success-muted)', color: grade.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 24px ${grade.color}44`,
        }}>
          <IconTrophy />
        </div>

        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: grade.color, marginBottom: 6 }}>
          {grade.label}
        </div>
        <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 900, color: 'var(--tx-primary)', letterSpacing: '-.04em', marginBottom: 4 }}>
          {score}/{questions.length}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--tx-secondary)', marginBottom: 'var(--sp-12)' }}>
          {pct}% score · {questions.length} questions
        </div>

        {/* Score ring */}
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto var(--sp-12)' }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="8" fill="none"/>
            <circle cx="50" cy="50" r="40" stroke={grade.color} strokeWidth="8" fill="none"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            />
          </svg>
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 'var(--text-md)', fontWeight: 800, color: 'var(--tx-primary)',
          }}>
            {pct}%
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={restart}>Retry Quiz</button>
          <button className="btn btn-primary" onClick={onFinished}>Finish</button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-quiz-card animate-fade-in" style={{ padding: 'var(--sp-6) var(--sp-8)' }}>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 'var(--sp-6)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--tx-disabled)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Question {idx + 1} of {questions.length}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 600 }}>
          Score: {score}
        </span>
      </div>

      <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--tx-primary)', marginBottom: 'var(--sp-6)', lineHeight: 1.4 }}>
        {q.question}
      </h3>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = i === q.correctAnswerIndex;
          let bg = 'var(--bg-elevated)';
          let border = 'var(--border)';
          let color = 'var(--tx-primary)';
          let icon = null;

          if (answered) {
            if (isCorrect) { bg = 'var(--success-muted)'; border = 'var(--success)'; color = 'var(--success)'; icon = <IconCheck />; }
            else if (isSelected) { bg = 'var(--danger-muted)'; border = 'var(--danger)'; color = 'var(--danger)'; icon = <IconX />; }
          } else if (isSelected) {
            bg = 'var(--accent-muted)'; border = 'var(--accent)';
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--sp-4) var(--sp-5)',
                background: bg, border: `1.5px solid ${border}`, borderRadius: 'var(--radius-lg)',
                color, fontSize: 'var(--text-md)', fontWeight: 500, cursor: answered ? 'default' : 'pointer',
                textAlign: 'left', transition: 'var(--t-fast)',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => { if (!answered) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-muted)'; } }}
              onMouseLeave={e => { if (!answered && selected !== i) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: answered && isCorrect ? 'var(--success)' : answered && isSelected && !isCorrect ? 'var(--danger)' : 'var(--bg-overlay)',
                  color: answered && (isCorrect || (isSelected && !isCorrect)) ? 'white' : 'var(--tx-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, flexShrink: 0,
                  border: '1px solid currentColor',
                }}>
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </div>
              {answered && icon && (
                <span style={{ flexShrink: 0 }}>{icon}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation & Next */}
      {answered && (
        <div style={{ marginTop: 'var(--sp-6)' }}>
          {q.explanation && (
            <div style={{
              padding: 'var(--sp-4) var(--sp-5)', borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-muted)', border: '1px solid var(--accent-border)',
              fontSize: 'var(--text-sm)', color: 'var(--tx-secondary)', lineHeight: 1.65,
              marginBottom: 'var(--sp-4)',
            }}>
              <strong style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <IconAI /> Explanation
              </strong>
              {q.explanation}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleNext}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {idx < questions.length - 1 ? 'Next Question' : 'View Results'} <IconArrow />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StudyCenter Dashboard ─────────────────────────────────────────────────────
export default function StudyCenter() {
  const { notes, getAICache, setAICache } = useNoteStore();
  const { openRightPanel, setActiveView } = useAppStore();

  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Question[] | null>(null);
  const [error, setError] = useState('');

  const activeNote = notes.find(n => n.id === selectedNoteId);
  const wordCount = activeNote?.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length ?? 0;

  const startQuiz = async () => {
    if (!activeNote) return;
    setError('');

    const cached = getAICache(activeNote.id, 'quiz');
    if (cached && cached.length > 0) { setActiveQuiz(cached); return; }

    setLoading(true);
    try {
      const plainText = activeNote.content?.replace(/<[^>]*>/g, '') || '';
      if (plainText.split(/\s+/).length < 20) {
        setError('Note needs at least 20 words to generate a quiz.');
        setLoading(false);
        return;
      }
      const quiz = await generateQuiz(plainText);
      if (quiz && quiz.length > 0) {
        await setAICache(activeNote.id, 'quiz', quiz);
        setActiveQuiz(quiz);
      } else {
        setError('Could not generate quiz. Make sure the note has enough content.');
      }
    } catch (err: any) {
      console.error('Quiz generation failed:', err);
      setError(err.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Active quiz ────────────────────────────────────────────────────────
  if (activeQuiz) {
    return (
      <div className="study-center animate-fade-in">
        <div style={{ maxWidth: 640, margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx-secondary)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              <IconGrad />
              {activeNote?.title || 'Untitled'} Quiz
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveQuiz(null)}
              style={{ color: 'var(--tx-tertiary)' }}
            >
              ← Back to Study Center
            </button>
          </div>
          <QuizSession questions={activeQuiz} onFinished={() => setActiveQuiz(null)} />
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="study-center animate-fade-in">
      <div style={{ maxWidth: 740, margin: '0 auto', width: '100%' }}>

        {/* Hero */}
        <div style={{ marginBottom: 'var(--sp-12)' }}>
          <div className="hero-eyebrow" style={{ marginBottom: 'var(--sp-4)' }}>
            <IconGrad /> Study Center
          </div>
          <h1 style={{
            fontSize: 'var(--text-5xl)', fontWeight: 'var(--weight-black)',
            letterSpacing: '-.04em', color: 'var(--tx-primary)', marginBottom: 'var(--sp-3)',
            lineHeight: 1.1,
          }}>
            Master Your <span className="gradient-text">Knowledge</span>
          </h1>
          <p style={{ color: 'var(--tx-secondary)', fontSize: 'var(--text-lg)', maxWidth: 520, lineHeight: 1.6 }}>
            Turn any note into a custom multiple-choice quiz, get AI summaries, and track what you know.
          </p>
        </div>

        {/* Note selector */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-2xl)', padding: 'var(--sp-8)',
          marginBottom: 'var(--sp-8)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <label style={{
            display: 'block', fontSize: 'var(--text-sm)', fontWeight: 700,
            color: 'var(--tx-secondary)', marginBottom: 'var(--sp-3)', letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}>
            Select Note to Study
          </label>

          {notes.length === 0 ? (
            <div style={{
              padding: 'var(--sp-8)', textAlign: 'center', borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border)', color: 'var(--tx-disabled)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
              <div style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-4)' }}>No notes yet</div>
              <button className="btn btn-primary btn-sm" onClick={() => setActiveView('notes')}>
                Create a Note
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {notes.map(note => {
                const words = note.content?.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length ?? 0;
                const isSelected = note.id === selectedNoteId;
                const hasQuiz = !!getAICache(note.id, 'quiz');
                return (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNoteId(note.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: 'var(--sp-4) var(--sp-5)',
                      background: isSelected ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      textAlign: 'left', transition: 'var(--t-fast)',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                    onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-elevated)'; } }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: isSelected ? 'var(--accent)' : 'var(--bg-overlay)',
                      border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? 'white' : 'var(--tx-tertiary)',
                    }}>
                      <IconNote />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: isSelected ? 'var(--accent)' : 'var(--tx-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {note.title?.trim() || 'Untitled'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--tx-disabled)', marginTop: 1 }}>
                        {words} words
                        {hasQuiz && <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 600 }}>✓ Quiz cached</span>}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ color: 'var(--accent)', flexShrink: 0 }}>
                        <IconCheck />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action cards */}
        {activeNote && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-5)', marginBottom: 'var(--sp-6)' }}>
            {/* Start Quiz */}
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-muted), hsla(296,80%,60%,.1))',
              border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-xl)',
              padding: 'var(--sp-7)', cursor: 'pointer',
              transition: 'var(--t-base)',
            }}
              onClick={activeNote.content?.trim() ? startQuiz : undefined}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-4)',
                background: 'var(--grad-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              }}>
                <IconGrad />
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--tx-primary)', marginBottom: 4 }}>
                {loading ? 'Generating…' : getAICache(activeNote.id, 'quiz') ? 'Retry Quiz' : 'Start Quiz'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)' }}>
                {wordCount} words · AI-generated MCQ
              </div>
              {loading && (
                <div style={{ marginTop: 8, color: 'var(--accent)' }}><IconSpinner /></div>
              )}
            </div>

            {/* AI Summary */}
            <div style={{
              background: 'linear-gradient(135deg, hsla(296,80%,60%,.08), hsla(340,85%,65%,.08))',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
              padding: 'var(--sp-7)', cursor: 'pointer',
              transition: 'var(--t-base)',
            }}
              onClick={() => openRightPanel('summary')}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-4)',
                background: 'var(--accent-muted)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
              }}>
                <IconAI />
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--tx-primary)', marginBottom: 4 }}>
                AI Summary
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--tx-secondary)' }}>
                Generate a smart overview
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: 'var(--sp-4) var(--sp-5)', borderRadius: 'var(--radius-lg)',
            background: 'var(--danger-muted)', border: '1px solid var(--danger)',
            color: 'var(--danger)', fontSize: 'var(--text-sm)',
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Start button */}
        {activeNote && !loading && (
          <button
            className="btn btn-primary btn-lg"
            onClick={startQuiz}
            disabled={loading || !activeNote.content?.trim()}
            id="study-start-quiz-main"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {loading ? <IconSpinner /> : <IconGrad />}
            {loading ? 'Generating Quiz…' : 'Generate & Start Quiz'}
          </button>
        )}

        {/* Tip strip */}
        <div style={{
          marginTop: 'var(--sp-12)', paddingTop: 'var(--sp-8)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-6)',
        }}>
          {[
            { emoji: '⚡', text: 'Results cached for re-use' },
            { emoji: '🎯', text: 'Multiple choice format' },
            { emoji: '💡', text: 'AI explanations per answer' },
          ].map(({ emoji, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--tx-tertiary)' }}>
              <span>{emoji}</span> {text}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
