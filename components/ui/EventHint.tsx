'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * First-time hint on the Log screen: an arrow that points up at the "Plan an occasion" icon (top right) with a short caption.
 * Place it inside a `relative` wrapper that is exactly as wide as the icon.
 * It is completely still on purpose (no pulse, no drawing, no sliding): it appears once, in its final place. The arrow tip is
 * always centred under the icon; the caption is measured once (and again only on resize) and moved sideways just enough to stay on
 * the screen, so nothing re-measures itself in a loop. Dismisses on any tap, or by itself after a few seconds; never blocks touches.
 */
export function EventHint({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const capRef = useRef<HTMLParagraphElement>(null);
  /** null until measured, so the caption never shows in the wrong place first. */
  const [shift, setShift] = useState<number | null>(null);

  useLayoutEffect(() => {
    const fit = () => {
      const cap = capRef.current;
      const box = cap?.parentElement;
      if (!cap || !box) return;
      const b = box.getBoundingClientRect(); // the icon's box: a transform on the caption never changes it
      const w = cap.offsetWidth;
      const left = b.left + b.width / 2 - w / 2;
      const m = 12; // keep this far from the screen edges
      const vw = window.innerWidth;
      let s = 0;
      if (left < m) s = m - left;
      else if (left + w > vw - m) s = vw - m - (left + w);
      setShift(Math.round(s));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const away = setTimeout(() => doneRef.current(), 8000);
    const tap = () => doneRef.current();
    window.addEventListener('pointerdown', tap, { once: true });
    return () => {
      clearTimeout(away);
      window.removeEventListener('pointerdown', tap);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-0 right-0 top-full flex flex-col items-center">
        <svg className="mt-1 text-good" width="30" height="42" viewBox="0 0 30 42" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 41 L15 4" />
          <path d="M9.5 10 L15 4 L20.5 10" />
        </svg>
        <p
          ref={capRef}
          className="w-max max-w-[230px] rounded-2xl border border-line bg-white px-3 py-1.5 text-center text-[12.5px] font-medium leading-snug text-ink shadow-sm"
          style={{ transform: `translateX(${shift ?? 0}px)`, visibility: shift === null ? 'hidden' : 'visible' }}
        >
          Planning a party or a trip? Plan an occasion and tick off what you pay.
        </p>
      </div>
    </div>
  );
}
