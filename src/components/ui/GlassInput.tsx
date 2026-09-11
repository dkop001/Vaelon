import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className = '', style, ...props }, ref) => {
    return (
      <div className="glass-input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && (
          <label
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--tx-secondary)',
              letterSpacing: '.02em',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`glass-input ${className}`}
          style={{
            background: 'var(--glass-bg-light)',
            backdropFilter: 'blur(var(--glass-blur-sm))',
            WebkitBackdropFilter: 'blur(var(--glass-blur-sm))',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--glass-border)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: 'var(--text-sm)',
            color: 'var(--tx-primary)',
            outline: 'none',
            transition: 'all var(--t-fast)',
            width: '100%',
            boxSizing: 'border-box',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)';
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{error}</span>
        )}
      </div>
    );
  }
);

GlassInput.displayName = 'GlassInput';

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ label, error, className = '', style, ...props }, ref) => {
    return (
      <div className="glass-textarea-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && (
          <label
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-medium)',
              color: 'var(--tx-secondary)',
              letterSpacing: '.02em',
            }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`glass-textarea ${className}`}
          style={{
            background: 'var(--glass-bg-light)',
            backdropFilter: 'blur(var(--glass-blur-sm))',
            WebkitBackdropFilter: 'blur(var(--glass-blur-sm))',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--glass-border)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: 'var(--text-sm)',
            color: 'var(--tx-primary)',
            outline: 'none',
            transition: 'all var(--t-fast)',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: 80,
            fontFamily: 'var(--font-sans)',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)';
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? 'var(--danger)' : 'var(--glass-border)';
            e.currentTarget.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {error && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>{error}</span>
        )}
      </div>
    );
  }
);

GlassTextarea.displayName = 'GlassTextarea';