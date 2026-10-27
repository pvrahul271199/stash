'use client';
import { BackIcon, DeleteIcon } from './Button';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Amount keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === 'del' ? 'Delete' : k}
          onClick={() => onKey(k)}
          className="num flex h-[54px] items-center justify-center rounded-key bg-tint text-[28px] text-ink active:opacity-70"
        >
          {k === 'del' ? <DeleteIcon /> : k}
        </button>
      ))}
    </div>
  );
}

export { BackIcon };
