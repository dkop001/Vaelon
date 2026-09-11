interface GlassCardProps {
  variant?: 'subtle' | 'light' | 'medium' | 'strong' | 'accent';
  blur?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const paddingMap = {
  none: 0,
  sm: 'var(--sp-3)',
  md: 'var(--sp-5)',
  lg: 'var(--sp-8)',
};

const blurMap = {
  sm: 'var(--glass-blur-sm)',
  md: 'var(--glass-blur-md)',
  lg: 'var(--glass-blur-lg)',
};

export default function GlassCard({
  variant = 'medium',
  blur = 'md',
  hover = false,
  padding = 'md',
  className = '',
  children,
  onClick,
}: GlassCardProps) {
  const variantClass = `glass${variant === 'medium' ? '' : `-${variant}`}`;
  const hoverClass = hover ? 'glass-hover' : '';

  return (
    <div
      className={`${variantClass} ${hoverClass} ${className}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: paddingMap[padding],
        backdropFilter: `blur(${blurMap[blur]}) saturate(var(--glass-saturate))`,
        WebkitBackdropFilter: `blur(${blurMap[blur]}) saturate(var(--glass-saturate))`,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'all var(--t-fast)',
      }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}