import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, Home, RotateCcw } from 'lucide-react';

const Quiz = ({ quizData, onGoHome }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);

  if (!quizData || quizData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
        <p>No quiz data available.</p>
        <button className="btn-primary" onClick={onGoHome} style={{ marginTop: '1rem' }}>
          Go Back Home
        </button>
      </div>
    );
  }

  const currentQuestion = quizData[currentQuestionIndex];

  const handleOptionClick = (index) => {
    if (isAnswered) return;
    setSelectedAnswer(index);
    setIsAnswered(true);

    if (index === currentQuestion.correctAnswerIndex) {
      setScore(score + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setShowResults(false);
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      width: '100%',
    }}>
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.div
            key="question"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="premium-card quiz-card"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderTop: '4px solid var(--accent-primary)',
            }}
          >
            <div className="quiz-meta" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}>
              <span>Question {currentQuestionIndex + 1} of {quizData.length}</span>
              <span>Score: {score}</span>
            </div>

            <h3 className="quiz-question" style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '2rem',
              lineHeight: 1.5,
            }}>
              {currentQuestion.question}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctAnswerIndex;
                
                let bgColor = 'var(--bg-secondary)';
                let borderColor = 'var(--border-color)';
                let textColor = 'var(--text-primary)';
                
                if (isAnswered) {
                  if (isCorrect) {
                    bgColor = 'hsla(142, 71%, 45%, 0.1)';
                    borderColor = 'hsl(142, 71%, 45%)';
                    textColor = 'hsl(142, 71%, 45%)';
                  } else if (isSelected && !isCorrect) {
                    bgColor = 'hsla(0, 84%, 60%, 0.1)';
                    borderColor = 'hsl(0, 84%, 60%)';
                    textColor = 'hsl(0, 84%, 60%)';
                  }
                } else if (isSelected) {
                   borderColor = 'var(--accent-primary)';
                }

                return (
                  <motion.button
                    key={index}
                    className="quiz-option"
                    whileHover={!isAnswered ? { scale: 1.01 } : {}}
                    whileTap={!isAnswered ? { scale: 0.99 } : {}}
                    onClick={() => handleOptionClick(index)}
                    disabled={isAnswered}
                    style={{
                      width: '100%',
                      padding: '1rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`,
                      color: textColor,
                      fontSize: '1rem',
                      textAlign: 'left',
                      cursor: isAnswered ? 'default' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                      minWidth: 0,
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{option}</span>
                    {isAnswered && isCorrect && <CheckCircle2 size={20} color="hsl(142, 71%, 45%)" style={{ flexShrink: 0 }} />}
                    {isAnswered && isSelected && !isCorrect && <XCircle size={20} color="hsl(0, 84%, 60%)" style={{ flexShrink: 0 }} />}
                  </motion.button>
                );
              })}
            </div>

            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="quiz-next-action"
                style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}
              >
                <button
                  className="btn-primary"
                  onClick={handleNextQuestion}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {currentQuestionIndex < quizData.length - 1 ? 'Next Question' : 'View Results'}
                  <ArrowRight size={18} />
                </button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card quiz-results"
            style={{
              textAlign: 'center',
              backgroundColor: 'var(--bg-tertiary)',
              borderTop: '4px solid var(--accent-primary)',
              padding: '3rem 2rem',
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'hsla(142, 71%, 45%, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <CheckCircle2 size={40} color="hsl(142, 71%, 45%)" />
            </div>
            
            <h2 style={{
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}>
              Quiz Completed!
            </h2>
            
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              marginBottom: '2.5rem',
            }}>
              You scored <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{score}</span> out of {quizData.length}
            </p>

            <div className="quiz-result-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleRestart}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'var(--transition)',
                }}
              >
                <RotateCcw size={18} />
                Try Again
              </button>
              
              <button
                onClick={onGoHome}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Home size={18} />
                Back to Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Quiz;
