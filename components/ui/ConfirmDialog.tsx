'use client';
import { useEffect, useRef } from 'react';

/** Accessible confirmation dialog. Warm (never red) for destructive actions.
 *  Focus starts on Cancel so a stray Enter can't delete anything. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/40 p-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        aria-describedby="cd-body"
        className="w-full rounded-[24px] bg-white p-6"
      >
        <h2 id="cd-title" className="text-section font-semibold text-ink">
          {title}
        </h2>
        <p id="cd-body" className="mt-2 text-body text-soft">
          {body}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onConfirm} className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm">
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="h-[50px] w-full rounded-btn border border-line text-[16px] font-semibold text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
