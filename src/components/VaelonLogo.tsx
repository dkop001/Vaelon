interface VaelonLogoProps {
  size?: number;
  className?: string;
}

export default function VaelonLogo({ size = 16, className }: VaelonLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Processing-core: system hexagon frame + orbital arc + intelligence node */}
      <path
        d="M8 2.2 13.02 5.1 13.02 10.9 8 13.8 2.98 10.9 2.98 5.1 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 3.9A4.8 4.8 0 0 1 10.5 12.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}
