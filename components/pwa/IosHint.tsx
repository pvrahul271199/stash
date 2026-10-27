'use client';
import { useEffect, useState } from 'react';
import { Note } from '../ui/Chip';

const KEY = 'stash-ios-hint-dismissed';

/** One-time hint on iPhone/iPad Safari when the app isn't installed. */
export function IosHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
      const standalone =
        (navigator as Navigator & { standalone?: boolean }).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
      if (ios && !standalone && !localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* private mode etc. */
    }
  }, []);

  if (!show) return null;
  return (
    <Note tone="neutral" className="mb-4 flex items-center justify-between gap-3">
      <span>Tap Share, then Add to Home Screen.</span>
      <button
        aria-label="Dismiss install hint"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </Note>
  );
}
