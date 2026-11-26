'use client';
import { useId, useState, type ReactNode } from 'react';

const read = (key: string, fallback: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback; // no storage (private window): just use the default
  }
};

/**
 * A titled block that folds away: the header shows the title and, while closed, a one-line summary; a chevron turns.
 * The open/closed choice is remembered on this device under `storageKey`. Closed content is `inert`, so it can't be tabbed into.
 */
export function Disclosure({
  title,
  hint,
  summary,
  storageKey,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** One line under the title while open. */
  hint?: string;
  /** What to show on the right while closed ("2 occasions · ₹900 of ₹1,250"). */
  summary?: ReactNode;
  storageKey?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => (storageKey ? read(storageKey, defaultOpen) : defaultOpen));
  const bodyId = useId();
  function toggle() {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  }
  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-0 w-full items-start justify-between gap-3 rounded-note py-1 text-left"
      >
        <span className="min-w-0">
          <span className="block text-section font-semibold text-ink">{title}</span>
          {open && hint && <span className="mt-0.5 block text-[13px] text-soft">{hint}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-1">
          {!open && summary && <span className="num text-[12px] text-soft">{summary}</span>}
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-soft transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </span>
      </button>
      {/* grid rows 0fr -> 1fr animates the height without measuring it */}
      <div
        id={bodyId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
