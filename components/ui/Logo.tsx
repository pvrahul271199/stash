/** Chelav logo: ink tile with the Malayalam letter ച (cha, as in ചെലവ്) drawn as one stroke. */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Chelav"
      className={className}
    >
      <rect width="100" height="100" rx="22" fill="#1E1B4B" />
      <g transform="translate(50 50) scale(0.78) translate(-49 -46)">
      <path
        d="M74 22 V70 H24 M32 54 C30 40 40 33 50 36 C62 40 62 58 50 70"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      </g>
    </svg>
  );
}
