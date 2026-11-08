'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * First-time hint on the Log screen: a hand-drawn arrow that draws itself and points up at the event pill, with a short caption
 * ("Planning a Goa trip? Create an event and log spends into it."). Place it inside a `relative` wrapper that is exactly as wide as the pill.
 * The arrow tip is always centred under the pill (whatever its width or the screen size); only the caption slides sideways
 * when it would run off a narrow screen. Dismisses on any tap, or by itself after a few seconds; never blocks touches.
 */
export function EventHint({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const capRef = useRef<HTMLParagraphElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    const fit = () => {
      const el = capRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const natural = r.left - shift; // where it sits with no shift
      const m = 12; // keep this far from the screen edges
      const w = window.innerWidth;
      let s = 0;
      if (natural < m) s = m - natural;
      else if (natural + r.width > w - m) s = w - m - (natural + r.width);
      if (Math.abs(s - shift) > 0.5) setShift(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [shift]);

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
      {/* soft pulse going out from the pill */}
      <span className="stash-ripple absolute -inset-1 rounded-full border-[1.5px] border-good/50" />
      <div className="absolute left-0 right-0 top-full flex flex-col items-center">
        {/* the arrow is symmetric about its own centre line, and the tip sits on it, so it points straight at the pill's centre */}
        <svg
          className="mt-1.5 text-good"
          width="30"
          height="34"
          viewBox="0 0 30 34"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="stash-draw" pathLength={1} d="M21 33 C 21 21, 15 18, 15 4" style={{ animationDelay: '150ms' }} />
          <path className="stash-draw" pathLength={1} d="M9.5 10 L15 4 L20.5 10" style={{ animationDelay: '800ms' }} />
        </svg>
        <p
          ref={capRef}
          className="stash-rise w-max max-w-[230px] rounded-2xl border border-line bg-white px-3 py-1.5 text-center text-[12.5px] font-medium leading-snug text-ink shadow-sm"
          style={{ animationDelay: '450ms', marginLeft: shift * 2 }}
        >
          Planning a Goa trip? Create an event and log your spends into it.
        </p>
      </div>
    </div>
  );
}
