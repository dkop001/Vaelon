import React from 'react';

export const SkeletonNoteInput = () => {
  return (
    <div className="premium-card" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '2.5rem 1rem' }}>
      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9375rem' }}>
        Loading workspace<span className="typing-dots"></span>
      </div>
    </div>
  );
};

export const SkeletonSummary = () => {
  return (
    <div className="premium-card summary-card" style={{ width: '100%', maxWidth: '800px', margin: '1.5rem auto 0', textAlign: 'center', padding: '2.5rem 1rem' }}>
      <div style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9375rem' }}>
        AI is thinking<span className="typing-dots"></span>
      </div>
    </div>
  );
};
