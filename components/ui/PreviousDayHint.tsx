'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * First-visit hint on Today: a hand-drawn arrow that draws itself and points at yesterday's date circle, with a short caption
 * ("Missed a day? Tap it to log."). It finds the circle in the day strip it is placed over (`host`), so it follows the real
 * layout. Dismisses on any tap, or by itself after a few seconds; never blocks touches meanwhile.
 */
export function PreviousDayHint({ host, onDone }: { host: React.RefObject<HTMLElement | null>; onDone: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // wait for the strip to centre itself on today, then measure yesterday's circle
    const measure = setTimeout(() => {
      const h = host.current;
      const today = h?.querySelector<HTMLElement>('[data-today]');
      const prev = today?.closest('li')?.previousElementSibling;
      const circle = prev?.querySelector<HTMLElement>('.num');
      if (!h || !circle) return doneRef.current(); // today is the first day of the month: nothing earlier to point at
      const hr = h.getBoundingClientRect();
      const cr = circle.getBoundingClientRect();
      setPos({ x: cr.left - hr.left + cr.width / 2, y: cr.top - hr.top + cr.height / 2 });
    }, 650);
    const away = setTimeout(() => doneRef.current(), 9000);
    const tap = () => doneRef.current();
    window.addEventListener('pointerdown', tap, { once: true });
    return () => {
      clearTimeout(measure);
      clearTimeout(away);
      window.removeEventListener('pointerdown', tap);
    };
  }, [host]);

  if (!pos) return null;
  const R = 22; // ring radius around the circle
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {/* a steady soft ring on yesterday's circle, with a pulse going out from it */}
      <span
        className="absolute rounded-full border-[1.5px] border-good/70"
        style={{ left: pos.x - R + 3, top: pos.y - R + 3, width: R * 2 - 6, height: R * 2 - 6 }}
      />
      <span
        className="stash-ripple absolute rounded-full border-[1.5px] border-good/45"
        style={{ left: pos.x - R, top: pos.y - R, width: R * 2, height: R * 2 }}
      />
      {/* small arrow coming down from the caption above, through the gap between two day labels, onto the circle's upper-left edge */}
      <svg
        className="absolute text-good"
        style={{ left: pos.x - 32, top: pos.y - 52 }}
        width="36"
        height="44"
        viewBox="0 0 36 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path className="stash-draw" pathLength={1} d="M6 0 C 6 20, 10 34, 24 38" style={{ animationDelay: '150ms' }} />
        <path className="stash-draw" pathLength={1} d="M16.3 40 L24 38 L18.4 32.3" style={{ animationDelay: '800ms' }} />
      </svg>
      {/* the caption, above the dates */}
      <p
        className="stash-rise absolute whitespace-nowrap rounded-full border border-line bg-white px-3 py-1 text-[12.5px] font-medium text-ink shadow-sm"
        style={{ left: Math.max(0, pos.x - 118), top: pos.y - 78, animationDelay: '450ms' }}
      >
        Missed a day? Tap it to log.
      </p>
    </div>
  );
}
