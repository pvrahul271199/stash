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
      <defs>
        <linearGradient id="chelav-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B3790" />
          <stop offset="1" stopColor="#17143D" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#chelav-g)" />
      <g transform="translate(50 50) scale(0.78) translate(-52 -49)">
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
