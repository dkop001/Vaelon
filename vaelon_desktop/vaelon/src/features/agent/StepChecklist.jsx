import { useState } from 'react';

const RISK_COLORS = {
  low: 'var(--success)',
  medium: 'var(--warning, #eab308)',
  high: 'var(--error, #ef4444)',
};

const STATUS_ICONS = {
  pending: '○',
  running: '◌',
  completed: '●',
  skipped: '⊘',
  failed: '✕',
};

const STATUS_COLORS = {
  pending: 'var(--tx-tertiary)',
  running: 'var(--accent)',
  completed: 'var(--success)',
  skipped: 'var(--tx-tertiary)',
  failed: 'var(--error, #ef4444)',
};

export default function StepChecklist({ plan, onApprove, onSkipStep, onAbort }) {
  const [approvedSteps, setApprovedSteps] = useState(
    () => new Set(plan.steps.filter(s => s.status === 'pending').map(s => s.id))
  );

  const toggleStep = (stepId) => {
    setApprovedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const approveAll = () => {
    setApprovedSteps(new Set(plan.steps.map(s => s.id)));
  };

  const handleApprove = () => {
    // Filter to only approved steps
    const stepsToRun = plan.steps.map(s => ({
      ...s,
      status: approvedSteps.has(s.id) ? 'pending' : 'skipped',
    }));
    onApprove({ ...plan, steps: stepsToRun });
  };

  return (
    <div className="step-checklist">
      <div className="step-checklist-header">
        <div className="step-checklist-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Plan: {plan.summary}</span>
        </div>
        <div className="step-checklist-actions">
          <button className="step-btn-secondary" onClick={approveAll}>
            Select All
          </button>
          <button className="step-btn-primary" onClick={handleApprove}>
            Run {approvedSteps.size} Step{approvedSteps.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      <div className="step-checklist-steps">
        {plan.steps.map((step, i) => {
          const isSelected = approvedSteps.has(step.id);
          const statusColor = STATUS_COLORS[step.status];
          const riskColor = RISK_COLORS[step.risk];

          return (
            <div
              key={step.id}
              className={`step-checklist-item ${isSelected ? 'selected' : ''} ${step.status}`}
              onClick={() => step.status === 'pending' && toggleStep(step.id)}
            >
              <div className="step-item-left">
                {step.status === 'pending' ? (
                  <div className={`step-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && '✓'}
                  </div>
                ) : (
                  <div className="step-status-icon" style={{ color: statusColor }}>
                    {STATUS_ICONS[step.status]}
                  </div>
                )}

                <div className="step-item-content">
                  <div className="step-item-header">
                    <span className="step-item-number">#{step.id}</span>
                    <span className="step-item-desc">{step.description}</span>
                  </div>

                  {step.command && (
                    <code className="step-item-command">{step.command}</code>
                  )}

                  <div className="step-item-meta">
                    {step.tool !== 'none' && (
                      <span className="step-tag">{step.tool}</span>
                    )}
                    <span className="step-risk" style={{ color: riskColor }}>
                      {step.risk} risk
                    </span>
                    {step.dependsOn.length > 0 && (
                      <span className="step-depends">depends on #{step.dependsOn.join(', #')}</span>
                    )}
                  </div>
                </div>
              </div>

              {step.result && (
                <div className={`step-result ${step.result.success ? 'success' : 'error'}`}>
                  {step.result.success ? '✓ Done' : `✕ ${step.result.error || 'Failed'}`}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
