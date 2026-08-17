import { useState, useEffect } from 'react';

type BannerVariant = 'error' | 'warning' | 'success' | 'info';

interface InlineBannerProps {
  message: string;
  variant?: BannerVariant;
  onDismiss?: () => void;
  autoDismiss?: number; // milliseconds, 0 = no auto dismiss
  action?: { label: string; onClick: () => void };
  title?: string;
}

const variantStyles: Record<BannerVariant, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  error: {
    bg: 'color-mix(in srgb, var(--danger) 10%, transparent)',
    border: 'var(--danger)',
    color: 'var(--danger)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  warning: {
    bg: 'color-mix(in srgb, var(--warning) 10%, transparent)',
    border: 'var(--warning)',
    color: 'var(--warning)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M7 1.5l6 11H1l6-11Z" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 5v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  success: {
    bg: 'color-mix(in srgb, var(--success) 10%, transparent)',
    border: 'var(--success)',
    color: 'var(--success)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  info: {
    bg: 'color-mix(in srgb, var(--accent) 10%, transparent)',
    border: 'var(--accent)',
    color: 'var(--accent)',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 4v3M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
};

export default function InlineBanner({ 
  message, 
  variant = 'error', 
  onDismiss, 
  autoDismiss = 5000,
  action,
  title,
}: InlineBannerProps) {
  const [visible, setVisible] = useState(true);
  const style = variantStyles[variant];

  useEffect(() => {
    if (autoDismiss > 0) {
      const timer = setTimeout(() => setVisible(false), autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss]);

  if (!visible) return null;

  return (
    <div
      className="inline-banner"
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: 'var(--sp-3) var(--sp-4)',
        borderRadius: 'var(--radius-sm)',
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        fontSize: 'var(--text-sm)',
        lineHeight: 1.5,
        animation: 'slideDown 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <span style={{ marginTop: 2 }}>{style.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{ fontWeight: 'var(--weight-semibold)', marginBottom: 2 }}>{title}</div>
        )}
        <div>{message}</div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-sm"
          style={{
            background: 'transparent',
            border: `1px solid ${style.border}`,
            color: style.color,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={() => { onDismiss(); setVisible(false); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: style.color,
            opacity: 0.6,
            padding: 4,
            cursor: 'pointer',
            flexShrink: 0,
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// Hook for managing banner state in components
export function useInlineBanner() {
  const [banner, setBanner] = useState<{
    message: string;
    variant: BannerVariant;
    action?: { label: string; onClick: () => void };
    title?: string;
  } | null>(null);

  const showBanner = (message: string, options?: { 
    variant?: BannerVariant; 
    action?: { label: string; onClick: () => void };
    title?: string;
  }) => {
    setBanner({ message, variant: options?.variant || 'error', action: options?.action, title: options?.title });
  };

  const hideBanner = () => setBanner(null);

  return { banner, showBanner, hideBanner };
}