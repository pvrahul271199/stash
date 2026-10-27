'use client';
import { inr } from '@/lib/format';
import type { CategoryTotal } from '@/lib/insights';

const C = 110;
const R = 100;
const r = 68;
const GROW = 6;

function pt(radius: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function arc(start: number, end: number, outer: number, inner: number): string {
  const sweep = Math.min(end - start, 359.99);
  const e = start + sweep;
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = pt(outer, start);
  const [x2, y2] = pt(outer, e);
  const [x3, y3] = pt(inner, e);
  const [x4, y4] = pt(inner, start);
  return `M${x1} ${y1} A${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function Donut({
  slices,
  colorOf,
  focus,
  onFocus,
}: {
  slices: CategoryTotal[];
  colorOf: Record<string, string>;
  focus: string | null;
  onFocus: (name: string) => void;
}) {
  const total = slices.reduce((s, c) => s + c.total, 0);
  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    acc += (s.total / total) * 360;
    return { s, start, end: acc };
  });
  const sel = slices.find((s) => s.name === focus) ?? null;

  return (
    <div className="relative mx-auto h-[220px] w-[220px]">
      <svg viewBox="0 0 220 220" width="220" height="220" role="group" aria-label="Spending by category">
        {arcs.map(({ s, start, end }) => {
          const on = s.name === focus;
          return (
            <path
              key={s.name}
              d={arc(start, end, on ? R + GROW : R, on ? r - GROW : r)}
              fill={colorOf[s.name]}
              stroke="#fff"
              strokeWidth={2}
              opacity={focus && !on ? 0.25 : 1}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={`${s.name}, ${Math.round(s.pct)} percent, ${inr(s.total)}`}
              onClick={() => onFocus(s.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFocus(s.name);
                }
              }}
              style={{ cursor: 'pointer', transition: 'opacity .15s' }}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
        {sel ? (
          <>
            <span className="text-[13px] font-semibold text-soft">{sel.name}</span>
            <span className="num text-[26px] text-ink">{inr(sel.total)}</span>
            <span className="text-[12px] text-faint">{Math.round(sel.pct)}% of spending</span>
          </>
        ) : (
          <>
            <span className="text-[13px] font-semibold text-soft">Total</span>
            <span className="num text-[26px] text-ink">{inr(total)}</span>
            <span className="text-[12px] text-faint">
              {slices.length} {slices.length === 1 ? 'category' : 'categories'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function CategoryList({
  slices,
  colorOf,
  focus,
  onFocus,
}: {
  slices: CategoryTotal[];
  colorOf: Record<string, string>;
  focus: string | null;
  onFocus: (name: string) => void;
}) {
  return (
    <ul className="mt-5 divide-y divide-line">
      {slices.map((s) => {
        const on = s.name === focus;
        const max = s.types[0]?.total || 1;
        return (
          <li key={s.name} style={{ opacity: focus && !on ? 0.55 : 1 }}>
            <button
              onClick={() => onFocus(s.name)}
              aria-pressed={on}
              className="flex min-h-[48px] w-full items-center gap-3 py-2 text-left"
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf[s.name] }} />
              <span className="flex-1 text-[15px] font-medium text-ink">{s.name}</span>
              <span className="text-[13px] text-faint">{Math.round(s.pct)}%</span>
              <span className="num w-[84px] text-right text-[17px] text-ink">{inr(s.total)}</span>
            </button>
            {on && (
              <ul className="mb-3 ml-6 flex flex-col gap-2.5">
                {s.types.map((t) => (
                  <li key={t.name}>
                    <div className="flex justify-between text-[13px] text-soft">
                      <span>{t.name}</span>
                      <span className="num text-ink">{inr(t.total)}</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-tint">
                      <div className="h-1 rounded-full" style={{ width: `${(t.total / max) * 100}%`, background: colorOf[s.name] }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
