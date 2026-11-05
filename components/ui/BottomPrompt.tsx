'use client';
import { useEffect, useRef } from 'react';

/** A short message that rises from the bottom, with one main action and an optional second one. */
export function BottomPrompt({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Shown as a quiet text button; closes the prompt. */
  secondaryLabel?: string;
  onClose: () => void;
}) {
  const actionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    actionRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="prompt-backdrop absolute inset-0 z-[70] flex items-end bg-ink/35"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bp-title"
        aria-describedby="bp-body"
        onClick={(e) => e.stopPropagation()}
        className="prompt-sheet w-full rounded-t-[28px] bg-white px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <h2 id="bp-title" className="text-section font-semibold text-ink">
          {title}
        </h2>
        <div id="bp-body" className="mt-1.5 max-h-[52vh] overflow-y-auto text-[14px] leading-relaxed text-soft">
          {body}
        </div>
        <div className="mt-5 flex flex-col gap-1">
          <button
            ref={actionRef}
            type="button"
            onClick={onAction}
            className="h-[50px] w-full rounded-btn bg-ink text-[16px] font-semibold text-white active:opacity-80"
          >
            {actionLabel}
          </button>
          {secondaryLabel && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] w-full text-[15px] font-medium text-soft"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
