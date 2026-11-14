'use client';
import { BackIcon } from './Button';

import type { Op } from '../../lib/calc';

// 4 columns: digits on the left, operators down the right edge.
const KEYS = ['1', '2', '3', '/', '4', '5', '6', '*', '7', '8', '9', '-', '00', '0', 'del', '+'] as const;
const PLAIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;
const GLYPH: Record<string, string> = { '/': '÷', '*': '×', '-': '−', '+': '+' };
const LABEL: Record<string, string> = { '/': 'Divide', '*': 'Multiply', '-': 'Subtract', '+': 'Add', '=': 'Equals', del: 'Delete' };

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

export function Keypad({
  onKey,
  pendingOp = null,
  opSelected = true,
  calc = false,
}: {
  onKey: (k: string) => void;
  pendingOp?: Op | null;
  /** Highlight the pending operator (true until the next number is typed). */
  opSelected?: boolean;
  /** Show the + − × ÷ column. Off = the plain 3-column digit pad (onboarding, stories). */
  calc?: boolean;
}) {
  return (
    <div className={`grid ${calc ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5`} role="group" aria-label="Amount keypad">
      {(calc ? KEYS : PLAIN_KEYS).map((key) => {
        const isOpKey = key in GLYPH;
        // While an operation is pending the spare "00" key becomes "=".
        const k = key === '00' && pendingOp ? '=' : key;
        const active = isOpKey && opSelected && pendingOp === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={LABEL[k] ?? k}
            aria-pressed={isOpKey ? active : undefined}
            onClick={() => onKey(k)}
            className={`num flex h-[44px] min-h-0 items-center justify-center rounded-key text-[22px] transition-colors duration-150 active:opacity-70 ${
              active
                ? 'bg-ink text-white'
                : k === '='
                  ? 'bg-ink/10 text-ink'
                  : isOpKey
                    ? 'bg-ink/[0.06] text-soft'
                    : 'bg-tint text-ink'
            }`}
          >
            {k === 'del' ? <CompactDeleteIcon /> : (GLYPH[k] ?? k)}
          </button>
        );
      })}
    </div>
  );
}

export { BackIcon };
