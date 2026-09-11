interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 14, className = '' }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle
        cx="8"
        cy="8"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="22 12"
        strokeLinecap="round"
      />
    </svg>
  );
}