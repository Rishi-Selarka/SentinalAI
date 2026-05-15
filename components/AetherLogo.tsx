/**
 * The Aether mark — four rounded blocks in an asymmetric 2×2 layout
 * (tall / short on the left column, short / tall on the right). Recreated
 * as a stroked SVG so it scales cleanly and inherits `currentColor`.
 */
export function AetherLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* top-left — tall */}
      <rect x="3" y="3" width="8" height="11" rx="2.5" />
      {/* bottom-left — short */}
      <rect x="3" y="16.5" width="8" height="4.5" rx="2" />
      {/* top-right — short */}
      <rect x="13" y="3" width="8" height="4.5" rx="2" />
      {/* bottom-right — tall */}
      <rect x="13" y="10" width="8" height="11" rx="2.5" />
    </svg>
  );
}
