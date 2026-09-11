interface SkeletonProps {
  lines?: number;
  widths?: number[];
  height?: number;
  className?: string;
}

export default function Skeleton({ lines = 3, widths = [100, 80, 60], height = 12, className = '' }: SkeletonProps) {
  return (
    <div className={`skeleton-container ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height,
            width: `${widths[i % widths.length]}%`,
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}