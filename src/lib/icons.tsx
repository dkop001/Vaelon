

type IconProps = { size?: number; className?: string };

const s = (size?: number) => size ?? 14;

export const Icons = {
  Search: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Plus: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Close: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <path d="M2 2l9 9M11 2 2 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ChevronRight: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M4.5 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Home: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M1.5 6.5 7 1.5l5.5 5V12a1 1 0 0 1-1 1H9v-3.5H5V13H2.5a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  Document: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <rect x="2" y="1.5" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 4.5h5M4 7h5M4 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  Star: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M7 1 8.3 5H12L9 7.5l1.1 4L7 9.2 3.9 11.5 5 7.5 2 5h3.7L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  Folder: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3.2l1.5 1.5h4.3a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1v-6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  Git: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="11" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 3h5M4.5 11h5M3 4.5v5M11 4.5v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  Terminal: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 5L6 7 3.5 9M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Builds: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M2 11h10M5 11V5M9 11V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Task: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 3v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Research: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3" />
      <path d="m9.5 9.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Chat: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M1.5 2.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5L2 12V8.5H2.5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
  Settings: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 1v1M7 12v1M1 7H2M12 7h1M2.34 2.34l.7.7M10.96 10.96l.7.7M11.66 2.34l-.7.7M3.04 10.96l-.7.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Theme: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M10.01 3.99 11.07 2.93M2.93 11.07l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Moon: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M12.5 9A5.5 5.5 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Menu: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 15 15" fill="none" className={className}>
      <path d="M1.5 3h12M1.5 7.5h12M1.5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  LogOut: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v7A1.5 1.5 0 0 0 2.5 12H5M9 4l3 3-3 3M13 7H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Send: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M12.5 1.5 1 6l5 1.5M12.5 1.5 8 13l-2-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Check: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <path d="M2 7l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Copy: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2.5 8.5H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  Spinner: ({ size, className }: IconProps) => (
    <svg width={s(size ?? 15)} height={s(size ?? 15)} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="22 12" strokeLinecap="round" />
    </svg>
  ),
  Stop: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Play: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M3.5 2.5l8 5-8 5V2.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  Alert: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4v4M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Trash: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <path d="M2 3.5h9M4.5 3.5v-1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5v4M7.5 5.5v4M3 3.5l.5 7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  File: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 13 13" fill="none" className={className}>
      <path d="M3 1h5.5L11 3.5V11.5A.5.5 0 0 1 10.5 12h-7.5A.5.5 0 0 1 2.5 11.5v-10A.5.5 0 0 1 3 1Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8.5 1v2.5H11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  Pin: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M7.5 1 11 4.5l-2 1-1 4-2.5 1.5L3 8.5 1.5 6 3 3.5l4-1 1-2L7.5 1Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  ),
  Code: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M4 2.5l5 5-5 5M10 2.5l-5 5 5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Memory: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M2 5h10M2 9h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5 3v1M9 3v1M5 11v1M9 11v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  ArrowLeft: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M7 10 3 6l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Info: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.5V10M7 4.2v.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  Sparkles: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M7 2.2 8 5.1l2.9 1-2.9 1L7 10l-1-2.9L3.1 6.1 6 5.1 7 2.2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 8.6l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z" fill="currentColor" />
    </svg>
  ),
  Gear: ({ size, className }: IconProps) => (
    <svg width={s(size)} height={s(size)} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M5.21 1.26 L10.79 1.26 L9.99 3.20 L6.01 3.20 Z M10.79 1.26 L14.74 5.21 L12.80 6.01 L9.99 3.20 Z M14.74 5.21 L14.74 10.79 L12.80 9.99 L12.80 6.01 Z M14.74 10.79 L10.79 14.74 L9.99 12.80 L12.80 9.99 Z M10.79 14.74 L5.21 14.74 L6.01 12.80 L9.99 12.80 Z M5.21 14.74 L1.26 10.79 L3.20 9.99 L6.01 12.80 Z M1.26 10.79 L1.26 5.21 L3.20 6.01 L3.20 9.99 Z M1.26 5.21 L5.21 1.26 L6.01 3.20 L3.20 6.01 Z M8 1.8 A6.2 6.2 0 1 0 8 14.2 A6.2 6.2 0 1 0 8 1.8 Z M8 5.3 A2.7 2.7 0 1 0 8 10.7 A2.7 2.7 0 1 0 8 5.3 Z"
      />
    </svg>
  ),
};
