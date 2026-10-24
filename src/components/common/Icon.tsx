import { DEFAULT_PAD_ICON, PAD_ICONS } from './padIcons';

/** The CueStage mark, drawn as inline SVG. */
export function CueStageMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="CueStage"
    >
      <rect x="3" y="12" width="3.2" height="7" rx="1.6" fill="currentColor" opacity="0.45" />
      <rect x="9" y="8" width="3.2" height="11" rx="1.6" fill="currentColor" opacity="0.75" />
      <rect x="15" y="4" width="3.2" height="15" rx="1.6" fill="currentColor" />
      <circle cx="16.6" cy="2" r="1.4" fill="#F5C542" />
      <path
        d="M3 21h18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.4"
      />
    </svg>
  );
}

export function PadIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Component = PAD_ICONS[name] ?? DEFAULT_PAD_ICON;
  return (
    <Component
      size={size}
      strokeWidth={1.8}
      className={className}
      aria-hidden="true"
    />
  );
}
