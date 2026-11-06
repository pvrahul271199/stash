'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** A short message that rises from the bottom, with one main action and an optional second one. */
export function BottomPrompt({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
  /** Shown as a quiet text button; closes the prompt unless `onSecondary` says otherwise. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose: () => void;
}) {
  const actionRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    // Move focus to the button for keyboard users, but never pull it out of a text field the user is in:
    // that would blur the field (its focus border flashes off) and drop the phone keyboard behind the sheet.
    const a = document.activeElement;
    const typing = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
    if (!typing) actionRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const node = (
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
              onClick={onSecondary ?? onClose}
              className="min-h-[44px] w-full text-[15px] font-medium text-soft"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
  // Rendered inside the app frame itself (not inside whatever screen opened it), so it never takes part in that
  // screen's layout. Falls back to inline if the frame is not found.
  const host = typeof document !== 'undefined' ? document.querySelector('.app-root') : null;
  return host ? createPortal(node, host) : node;
}
