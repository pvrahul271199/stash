'use client';
import { BackIcon } from './Button';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

const CompactDeleteIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7 6-7z" />
    <path d="M13 10l4 4M17 10l-4 4" />
  </svg>
);

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Amount keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === 'del' ? 'Delete' : k}
          onClick={() => onKey(k)}
          className="num flex h-[44px] min-h-0 items-center justify-center rounded-key bg-tint text-[22px] text-ink active:opacity-70"
        >
          {k === 'del' ? <CompactDeleteIcon /> : k}
        </button>
      ))}
    </div>
  );
}

export { BackIcon };
