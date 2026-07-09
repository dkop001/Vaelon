export default function StepCheckpoint({ step, stepIndex, totalSteps, onContinue, onSkip, onAbort }) {
  if (!step) return null;

  const isFailed = step.status === 'failed';

  return (
    <div className={`step-checkpoint ${isFailed ? 'failed' : 'success'}`}>
      <div className="step-checkpoint-header">
        <div className="step-checkpoint-icon">
          {isFailed ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error, #ef4444)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
        </div>
        <div className="step-checkpoint-info">
          <span className="step-checkpoint-title">
            Step {stepIndex + 1}/{totalSteps}: {isFailed ? 'Failed' : 'Completed'}
          </span>
          <span className="step-checkpoint-desc">{step.description}</span>
        </div>
      </div>

      {step.result && (
        <div className="step-checkpoint-result">
          {isFailed ? (
            <div className="step-result-error">
              <code>{step.result.error || 'Unknown error'}</code>
            </div>
          ) : (
            <div className="step-result-success">
              {step.result.stdout && (
                <pre className="step-result-output">{step.result.stdout.slice(0, 300)}</pre>
              )}
              {step.result.content && (
                <pre className="step-result-output">{step.result.content.slice(0, 300)}</pre>
              )}
              {step.result.message && (
                <span>{step.result.message}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="step-checkpoint-actions">
        {!isFailed && (
          <button className="step-btn-primary" onClick={onContinue}>
            Continue
          </button>
        )}
        {isFailed && (
          <>
            <button className="step-btn-primary" onClick={onSkip}>
              Skip & Continue
            </button>
            <button className="step-btn-secondary" onClick={onAbort}>
              Abort
            </button>
          </>
        )}
        {!isFailed && (
          <button className="step-btn-secondary" onClick={onAbort}>
            Abort
          </button>
        )}
      </div>
    </div>
  );
}
