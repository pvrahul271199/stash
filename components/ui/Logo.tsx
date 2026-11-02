/** Stash logo: ink tile, "Stash" wordmark in the display font, teal underline. Pure SVG, scales to any size. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Stash"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#1E1B4B" />
      <text
        x="50"
        y="56"
        textAnchor="middle"
        fill="#fff"
        fontSize="26"
        fontWeight="600"
        letterSpacing="-0.5"
        style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        Stash
      </text>
      <rect x="38" y="66" width="24" height="5" rx="2.5" fill="#5EEAD4" />
    </svg>
  );
}
