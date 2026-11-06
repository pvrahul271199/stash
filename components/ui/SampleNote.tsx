'use client';
import { useEffect, useRef, useState } from 'react';

/** A tiny, non-blocking note that fades away by itself after 3 seconds. No buttons: leaving the sample is on the Profile tab. */
export function SampleNote({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  // a ref, so a parent re-render (new function each time) never restarts the 3 seconds
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 2600);
    const done = setTimeout(() => doneRef.current(), 3000);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-6"
      style={{ bottom: 'calc(var(--safe-bottom) + 200px)' }}
    >
      <p
        className={`stash-rise flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] leading-snug text-ink shadow-md transition-opacity duration-500 ${
          leaving ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-good" aria-hidden="true" />
        <span>
          <span className="font-semibold">Sample data.</span> Nothing you log here is saved.
        </span>
      </p>
    </div>
  );
}
