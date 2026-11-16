'use client';
import { useEffect, useState, type ReactNode } from 'react';

export interface RingSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * A donut that draws itself: every segment sweeps in around the ring, one after another, when it appears.
 * Pure SVG (stroke-dasharray), no library. `prefers-reduced-motion` turns the sweep into an instant draw (app/globals.css).
 * Segments can be tapped (`onSelect`): the chosen one grows and the rest fade. `children` sit in the middle of the ring.
 */
export function RecapRing({
  segments,
  size = 200,
  stroke = 22,
  label,
  selected = null,
  onSelect,
  children,
}: {
  segments: RingSegment[];
  size?: number;
  stroke?: number;
  /** Spoken description of the chart. */
  label: string;
  /** Name of the highlighted segment, if any. */
  selected?: string | null;
  /** Makes the segments tappable; called with the tapped name. */
  onSelect?: (name: string) => void;
  children?: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 40);
    return () => clearTimeout(id);
  }, []);

  const GROW = 6;
  const r = (size - stroke - GROW) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let acc = 0;
  const arcs = segments.map((s) => {
    const len = total > 0 ? (Math.max(0, s.value) / total) * C : 0;
    const a = { ...s, len: Math.max(0, len - gap), offset: acc };
    acc += len;
    return a;
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role={onSelect ? 'group' : 'img'} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-tint" />
        {arcs.map((a, i) => {
          const on = selected === a.name;
          const faded = selected != null && !on;
          const tap = onSelect ? () => onSelect(a.name) : undefined;
          return (
            <circle
              key={a.name}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={on ? stroke + GROW : stroke}
              strokeLinecap="butt"
              strokeDasharray={`${ready ? a.len : 0} ${C}`}
              strokeDashoffset={-a.offset}
              opacity={faded ? 0.25 : 1}
              style={{
                transition: `stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms, stroke-width 160ms, opacity 160ms`,
                cursor: tap ? 'pointer' : undefined,
              }}
              {...(tap
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': on,
                    'aria-label': a.name,
                    onClick: tap,
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        tap();
                      }
                    },
                  }
                : { 'aria-hidden': true })}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
        {children}
      </div>
    </div>
  );
}
