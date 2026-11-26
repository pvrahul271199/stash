'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Step {
  /** Which control to point at: it carries `data-hint="<key>"` inside the host. */
  key: 'event' | 'plan';
  text: string;
}

const STEPS: Step[] = [
  { key: 'event', text: 'Going on a trip? Tag your spends to an event.' },
  { key: 'plan', text: 'Going shopping? Plan what to buy here.' },
];

const STEP_MS = 4200;

/**
 * First-time hints on the Log screen, in the same hand-drawn style as "Missed a day?" on Today: a soft ring around the
 * control, a curved arrow that draws itself up to it, and a short caption. It points at the event tag first, then at the
 * Plan icon. It finds the controls inside `host` (the header row) so it follows the real layout, keeps every caption on the
 * screen, never blocks touches, and ends on any tap or after both steps.
 */
export function LogHints({ host, skip = [], onDone }: { host: React.RefObject<HTMLElement | null>; skip?: Step['key'][]; onDone: () => void }) {
  const steps = STEPS.filter((s) => !skip.includes(s.key));
  const [i, setI] = useState(-1); // -1 = waiting for the screen to settle
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const start = setTimeout(() => setI(0), 700);
    const tap = () => doneRef.current();
    window.addEventListener('pointerdown', tap, { once: true });
    return () => {
      clearTimeout(start);
      window.removeEventListener('pointerdown', tap);
    };
  }, []);

  useEffect(() => {
    if (i < 0) return;
    const t = setTimeout(() => (i + 1 >= steps.length ? doneRef.current() : setI(i + 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [i, steps.length]);

  if (i < 0 || i >= steps.length) return null;
  return <Hint key={steps[i].key} host={host} step={steps[i]} onMissing={() => doneRef.current()} />;
}

function Hint({ host, step, onMissing }: { host: React.RefObject<HTMLElement | null>; step: Step; onMissing: () => void }) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; vw: number } | null>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const [shift, setShift] = useState<number | null>(null);
  const [capW, setCapW] = useState(0);

  useLayoutEffect(() => {
    const h = host.current;
    const el = h?.querySelector<HTMLElement>(`[data-hint="${step.key}"]`);
    if (!h || !el) return onMissing();
    const hr = h.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height, vw: window.innerWidth });
  }, [host, step.key, onMissing]);

  // keep the caption inside the screen: measure it once, then slide it sideways just enough
  useLayoutEffect(() => {
    const cap = capRef.current;
    if (!box || !cap) return;
    const hr = host.current?.getBoundingClientRect();
    const hostLeft = hr?.left ?? 0;
    // the app is a centred column on wide screens: keep the caption inside that column, not just inside the window
    const col = host.current?.closest('[role="dialog"], main, [data-app-col]')?.getBoundingClientRect();
    const minX = Math.max(0, col?.left ?? 0);
    const maxX = Math.min(box.vw, col ? col.right : box.vw);
    const w = cap.offsetWidth;
    const centre = hostLeft + box.x + box.w / 2 - 6;
    const m = 20;
    let left = centre - w / 2;
    if (left + w > maxX - m - 28) left = maxX - m - 28 - w; // the Plan caption sits further left of the edge
    if (left < minX + m) left = minX + m;
    setCapW(w);
    setShift(Math.round(left - hostLeft)); // left edge of the caption, relative to the host
  }, [box, host]);

  if (!box) return null;
  const cx = box.x + box.w / 2;
  const bottom = box.y + box.h;
  const round = box.w - box.h < 6; // an icon gets a round ring, a pill gets a pill ring
  const pad = round ? 5 : 4;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
      {/* soft ring with a pulse going out from it */}
      <span
        className="absolute rounded-full border-[1.5px] border-good/70"
        style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}
      />
      <span
        className="stash-ripple absolute rounded-full border-[1.5px] border-good/40"
        style={{ left: box.x - pad - 3, top: box.y - pad - 3, width: box.w + pad * 2 + 6, height: box.h + pad * 2 + 6 }}
      />
      {/* curved arrow from the caption up to the control: it starts under the caption wherever the caption ended up */}
      {(() => {
        const left = shift ?? cx - capW / 2;
        const tailX = Math.min(Math.max(cx, left + 18), left + Math.max(capW, 36) - 18);
        const dx = tailX - cx;
        const headX = 14 + Math.max(0, -dx);
        const tail = headX + dx;
        const w = 30 + Math.abs(dx);
        return (
          <svg
            className="absolute text-good"
            style={{ left: cx - headX, top: bottom + pad + 1 }}
            width={w}
            height="55"
            viewBox={`0 0 ${w} 55`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="stash-draw" pathLength={1} d={`M${tail} 55 C ${tail} 34, ${headX} 26, ${headX} 4`} style={{ animationDelay: '150ms' }} />
            <path className="stash-draw" pathLength={1} d={`M${headX - 5.6} 10 L${headX} 4 L${headX + 5.6} 10`} style={{ animationDelay: '800ms' }} />
          </svg>
        );
      })()}
      <p
        ref={capRef}
        className="stash-rise absolute w-max max-w-[260px] rounded-2xl border border-line bg-white px-3.5 py-2 text-center text-[12.5px] font-medium leading-snug text-ink shadow-[0_6px_18px_-8px_rgba(30,27,75,0.35)]"
        style={{ left: shift ?? 0, top: bottom + pad + 58, animationDelay: '450ms', visibility: shift === null ? 'hidden' : 'visible' }}
      >
        {step.text}
      </p>
    </div>
  );
}
