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
      {/* Hex-geometry V: the two lower edges of a hexagon meeting at the bottom vertex (60° interior) */}
      <path
        d="M 3.5 4.2 L 8 12 L 12.5 4.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
